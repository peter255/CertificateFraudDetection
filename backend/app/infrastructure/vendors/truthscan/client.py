from __future__ import annotations

import asyncio
import time
from uuid import uuid4

import httpx

from app.infrastructure.configuration.settings import Settings
from app.infrastructure.vendors.truthscan.mapper import TruthScanResponseMapper
from app.infrastructure.vendors.truthscan.models import TruthScanVerifyResponse
from app.shared.exceptions.base import VendorError
from app.shared.logging.logger import get_logger

_S3_BASE = "https://ai-image-detector-prod.nyc3.digitaloceanspaces.com/"
_POLL_INTERVAL = 1.0        # Prefer snappy completion detection over sparse polling.
_MAX_POLL_ATTEMPTS = 90     # ~90 seconds maximum wait

logger = get_logger(__name__)


class TruthScanClient:
    """
    Independent Verification Engine V1 adapter.

    Flow (unchanged):
      1. GET  /get-presigned-url  — obtain a short-lived S3 upload URL
      2. PUT  <presigned_url>     — upload the raw document bytes
      3. POST /detect             — trigger AI analysis; receive a job ID
      4. POST /query (poll)       — wait for status == "done"
    """

    def __init__(self, settings: Settings) -> None:
        if not settings.truthscan_api_key:
            raise VendorError(
                "Verification Engine V1 API key is not configured.",
                "TRUTHSCAN_MISSING_KEY",
            )
        self._api_key = settings.truthscan_api_key
        self._base_url = (settings.truthscan_base_url or "https://detect-image.truthscan.com").rstrip("/")
        self._timeout = float(settings.truthscan_timeout)
        self._mapper = TruthScanResponseMapper()

    async def verify(
        self,
        content: bytes,
        *,
        filename: str = "certificate.bin",
        document_type: str = "academic_certificate",
        holder_name: str = "Unknown",
        issuer_name: str = "Unknown",
        certificate_id: str | None = None,
    ) -> TruthScanVerifyResponse:
        started = time.perf_counter()
        cert_id = certificate_id or str(uuid4())

        if len(content) < 8_000:
            raise VendorError(
                "File is too small. Please upload a larger certificate image or PDF.",
                "TRUTHSCAN_API_ERROR",
            )
        content_type = _detect_content_type(content)
        if content_type == "application/octet-stream":
            raise VendorError(
                "Unsupported file type. Please upload a PNG, JPEG, or PDF certificate.",
                "TRUTHSCAN_API_ERROR",
            )

        logger.info("[V1] Uploading file...")
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            file_path = await self._upload(client, content, content_type, cert_id)
            logger.info("[V1] Upload complete.")
            logger.info("[V1] Running analysis...")
            job_id = await self._detect(client, file_path)
            logger.info("[V1] Polling...")
            raw_result = await self._poll(client, job_id)

        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.info("[V1] Completed.")
        logger.info("[V1] Duration: %s ms", duration_ms)
        logger.info("[V1] --------------------------------")

        return self._mapper.map(
            raw_result,
            document_type=document_type,
            holder_name=holder_name,
            issuer_name=issuer_name,
            duration_ms=duration_ms,
            certificate_id=cert_id,
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Private helpers — upload / detect / poll business logic unchanged
    # ──────────────────────────────────────────────────────────────────────────

    async def _upload(
        self,
        client: httpx.AsyncClient,
        content: bytes,
        content_type: str,
        certificate_id: str,
    ) -> str:
        extension = _extension_for(content_type)
        filename = f"cert_{certificate_id}{extension}"

        # Step 1 — obtain presigned S3 upload URL
        try:
            resp = await client.get(
                f"{self._base_url}/get-presigned-url",
                params={"file_name": filename},
                headers={"apikey": self._api_key},
            )
        except httpx.RequestError as exc:
            raise VendorError(
                "Verification Engine V1 is unavailable. Please try again later.",
                "TRUTHSCAN_UNAVAILABLE",
            ) from exc

        if resp.status_code in (401, 403, 404):
            raise VendorError(
                "Verification Engine V1 authentication failed. Check engine credentials.",
                "TRUTHSCAN_AUTH_FAILED",
            )
        _raise_for_vendor_error(resp, "get-presigned-url")
        upload_info: dict = resp.json()

        presigned_url: str = upload_info["presigned_url"]
        file_path: str = upload_info["file_path"]

        # Step 2 — PUT raw bytes directly to S3
        try:
            upload_resp = await client.put(
                presigned_url,
                content=content,
                headers={
                    "Content-Type": content_type,
                    "x-amz-acl": "private",
                },
            )
        except httpx.RequestError as exc:
            raise VendorError(
                "Verification Engine V1 upload failed. Please try again later.",
                "TRUTHSCAN_UPLOAD_FAILED",
            ) from exc

        if upload_resp.status_code >= 400:
            raise VendorError(
                "Verification Engine V1 upload failed.",
                "TRUTHSCAN_UPLOAD_FAILED",
            )

        return file_path

    async def _detect(self, client: httpx.AsyncClient, file_path: str) -> str:
        # Step 3 — trigger analysis; request analysis_details for richer signals
        try:
            resp = await client.post(
                f"{self._base_url}/detect",
                json={
                    "key": self._api_key,
                    "url": _S3_BASE + file_path,
                    "model": "generic",
                    "generate_preview": False,
                    "generate_analysis_details": True,
                    "generate_heatmap": True,
                },
                headers={"Content-Type": "application/json", "accept": "application/json"},
            )
        except httpx.RequestError as exc:
            raise VendorError(
                "Verification Engine V1 is unavailable. Please try again later.",
                "TRUTHSCAN_UNAVAILABLE",
            ) from exc

        if resp.status_code in (401, 403):
            raise VendorError(
                "Verification Engine V1 authentication failed. Check engine credentials.",
                "TRUTHSCAN_AUTH_FAILED",
            )
        _raise_for_vendor_error(resp, "detect")
        try:
            return resp.json()["id"]
        except (KeyError, TypeError, ValueError) as exc:
            raise VendorError(
                "Verification Engine V1 returned an unexpected response.",
                "TRUTHSCAN_UNEXPECTED_RESPONSE",
            ) from exc

    async def _poll(self, client: httpx.AsyncClient, job_id: str) -> dict:
        # Step 4 — poll until core status is done AND analysis details are ready
        for _ in range(_MAX_POLL_ATTEMPTS):
            await asyncio.sleep(_POLL_INTERVAL)

            try:
                resp = await client.post(
                    f"{self._base_url}/query",
                    json={"id": job_id},
                    headers={"Content-Type": "application/json", "accept": "application/json"},
                )
            except httpx.RequestError as exc:
                raise VendorError(
                    "Verification Engine V1 is unavailable. Please try again later.",
                    "TRUTHSCAN_UNAVAILABLE",
                ) from exc

            resp.raise_for_status()
            data: dict = resp.json()

            status = data.get("status")
            if status == "failed":
                raise VendorError(
                    f"Verification Engine V1 analysis failed for job {job_id}.",
                    "TRUTHSCAN_ANALYSIS_FAILED",
                )
            if status != "done":
                continue

            details: dict = data.get("result_details") or {}
            analysis_status = details.get("analysis_results_status")
            # Keep waiting while secondary analysis job is still running.
            if analysis_status in ("pending", "processing", "running"):
                continue
            return data

        raise VendorError(
            f"Verification Engine V1 did not complete analysis within {_MAX_POLL_ATTEMPTS * _POLL_INTERVAL}s.",
            "TRUTHSCAN_TIMEOUT",
        )


# ──────────────────────────────────────────────────────────────────────────────
# Module-level helpers (no state, pure functions)
# ──────────────────────────────────────────────────────────────────────────────

def _detect_content_type(content: bytes) -> str:
    if content[:4] == b"%PDF":
        return "application/pdf"
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if content[:2] == b"\xff\xd8":
        return "image/jpeg"
    return "application/octet-stream"


def _extension_for(content_type: str) -> str:
    return {
        "application/pdf": ".pdf",
        "image/png": ".png",
        "image/jpeg": ".jpg",
    }.get(content_type, ".bin")


def _raise_for_vendor_error(response: httpx.Response, endpoint: str) -> None:
    if response.status_code == 429:
        raise VendorError("Verification Engine V1 rate limit exceeded.", "TRUTHSCAN_RATE_LIMITED")
    if response.status_code >= 400:
        detail = _extract_vendor_message(response)
        message = detail or f"Verification Engine V1 /{endpoint} returned HTTP {response.status_code}."
        raise VendorError(message, "TRUTHSCAN_API_ERROR")


def _extract_vendor_message(response: httpx.Response) -> str | None:
    try:
        payload = response.json()
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    for key in ("error", "message", "detail"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None
