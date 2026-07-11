from __future__ import annotations

import asyncio

import httpx

from app.domain.entities.certificate import Certificate
from app.domain.entities.verification_report import VendorFinding
from app.infrastructure.configuration.settings import Settings
from app.infrastructure.vendors.truthscan.response_mapper import TruthScanResponseMapper
from app.shared.exceptions.base import VendorError

_S3_BASE = "https://ai-image-detector-prod.nyc3.digitaloceanspaces.com/"
_POLL_INTERVAL = 3          # seconds between /query requests
_MAX_POLL_ATTEMPTS = 30     # 90 seconds maximum wait


class TruthScanClient:
    """
    Adapter that satisfies IVendorVerificationPort by delegating to the TruthScan REST API.

    Flow:
      1. GET  /get-presigned-url  — obtain a short-lived S3 upload URL
      2. PUT  <presigned_url>     — upload the raw document bytes
      3. POST /detect             — trigger AI analysis; receive a job ID
      4. POST /query (poll)       — wait for status == "done"

    HTTP transport, retry logic, and response parsing live here.
    No business logic is performed; this class translates between the
    TruthScan wire format and the VendorFinding domain object.
    """

    def __init__(self, settings: Settings) -> None:
        if not settings.truthscan_api_key:
            raise VendorError(
                "TruthScan API key is not configured.",
                "TRUTHSCAN_MISSING_KEY",
            )
        self._api_key = settings.truthscan_api_key
        self._base_url = (settings.truthscan_base_url or "https://detect-image.truthscan.com").rstrip("/")
        self._mapper = TruthScanResponseMapper()

    async def verify(self, certificate: Certificate) -> VendorFinding:
        if len(certificate.raw_content) < 8_000:
            raise VendorError(
                "File is too small. Please upload a larger certificate image or PDF.",
                "TRUTHSCAN_API_ERROR",
            )
        content_type = _detect_content_type(certificate.raw_content)
        if content_type == "application/octet-stream":
            raise VendorError(
                "Unsupported file type. Please upload a PNG, JPEG, or PDF certificate.",
                "TRUTHSCAN_API_ERROR",
            )

        async with httpx.AsyncClient(timeout=60.0) as client:
            file_path = await self._upload(client, certificate)
            job_id = await self._detect(client, file_path)
            raw_result = await self._poll(client, job_id)
        return self._mapper.map(raw_result)

    # ──────────────────────────────────────────────────────────────────────────
    # Private helpers
    # ──────────────────────────────────────────────────────────────────────────

    async def _upload(self, client: httpx.AsyncClient, certificate: Certificate) -> str:
        content_type = _detect_content_type(certificate.raw_content)
        extension = _extension_for(content_type)
        filename = f"cert_{certificate.id}{extension}"

        # Step 1 — obtain presigned S3 upload URL
        resp = await client.get(
            f"{self._base_url}/get-presigned-url",
            params={"file_name": filename},
            headers={"apikey": self._api_key},
        )
        _raise_for_vendor_error(resp, "get-presigned-url")
        upload_info: dict = resp.json()

        presigned_url: str = upload_info["presigned_url"]
        file_path: str = upload_info["file_path"]

        # Step 2 — PUT raw bytes directly to S3
        upload_resp = await client.put(
            presigned_url,
            content=certificate.raw_content,
            headers={
                "Content-Type": content_type,
                "x-amz-acl": "private",
            },
        )
        upload_resp.raise_for_status()

        return file_path

    async def _detect(self, client: httpx.AsyncClient, file_path: str) -> str:
        # Step 3 — trigger analysis; request analysis_details for richer signals
        resp = await client.post(
            f"{self._base_url}/detect",
            json={
                "key": self._api_key,
                "url": _S3_BASE + file_path,
                "model": "generic",
                "generate_preview": False,
                "generate_analysis_details": True,
                "generate_heatmap": False,
            },
            headers={"Content-Type": "application/json", "accept": "application/json"},
        )
        _raise_for_vendor_error(resp, "detect")
        return resp.json()["id"]

    async def _poll(self, client: httpx.AsyncClient, job_id: str) -> dict:
        # Step 4 — poll until core status is done AND analysis details are ready
        for _ in range(_MAX_POLL_ATTEMPTS):
            await asyncio.sleep(_POLL_INTERVAL)

            resp = await client.post(
                f"{self._base_url}/query",
                json={"id": job_id},
                headers={"Content-Type": "application/json", "accept": "application/json"},
            )
            resp.raise_for_status()
            data: dict = resp.json()

            status = data.get("status")
            if status == "failed":
                raise VendorError(
                    f"TruthScan analysis failed for job {job_id}.",
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
            f"TruthScan did not complete analysis within {_MAX_POLL_ATTEMPTS * _POLL_INTERVAL}s.",
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
        raise VendorError("TruthScan rate limit exceeded.", "TRUTHSCAN_RATE_LIMITED")
    if response.status_code >= 400:
        detail = _extract_vendor_message(response)
        message = detail or f"TruthScan /{endpoint} returned HTTP {response.status_code}."
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
