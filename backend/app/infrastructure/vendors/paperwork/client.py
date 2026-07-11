from __future__ import annotations

import asyncio
import mimetypes
import time
from pathlib import PurePosixPath

import httpx

from app.infrastructure.configuration.settings import Settings
from app.infrastructure.vendors.paperwork.mapper import PaperworkResponseMapper
from app.infrastructure.vendors.paperwork.models import PaperworkVerifyResponse
from app.shared.exceptions.base import VendorError
from app.shared.logging.logger import get_logger

_POLL_INTERVAL = 5
_MAX_POLL_ATTEMPTS = 60  # 5 minutes

logger = get_logger(__name__)


class PaperworkClient:
    """
    Independent Verification Engine V2 adapter.

    Flow:
      1. POST /api/v1/fraud-detection/async/upload  — multipart upload
      2. GET  /api/v1/fraud-detection/status/{job_id} — poll until completed
    """

    def __init__(self, settings: Settings) -> None:
        if not settings.paperwork_api_key:
            raise VendorError(
                "Verification Engine V2 API key is not configured.",
                "PAPERWORK_MISSING_KEY",
            )
        self._api_key = settings.paperwork_api_key
        self._base_url = (settings.paperwork_base_url or "https://api.paperwork.to").rstrip("/")
        self._timeout = float(settings.paperwork_timeout)
        self._mapper = PaperworkResponseMapper()

    async def verify(
        self,
        content: bytes,
        *,
        filename: str = "certificate.bin",
        document_type: str = "auto",
        ocr_mode: str = "auto",
    ) -> PaperworkVerifyResponse:
        started = time.perf_counter()
        safe_name = PurePosixPath(filename).name or "certificate.bin"
        content_type = _detect_content_type(content, safe_name)

        logger.info("[V2] Uploading...")
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            job_id = await self._upload(
                client,
                content=content,
                filename=safe_name,
                content_type=content_type,
                document_type=document_type or "auto",
                ocr_mode=ocr_mode or "auto",
            )
            logger.info("[V2] Processing...")
            status_payload = await self._poll(client, job_id)

        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.info("[V2] Completed.")
        logger.info("[V2] Duration: %s ms", duration_ms)
        logger.info("[V2] --------------------------------")

        return self._mapper.map(status_payload, duration_ms=duration_ms)

    async def _upload(
        self,
        client: httpx.AsyncClient,
        *,
        content: bytes,
        filename: str,
        content_type: str,
        document_type: str,
        ocr_mode: str,
    ) -> str:
        url = f"{self._base_url}/api/v1/fraud-detection/async/upload"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
        }
        files = {"files": (filename, content, content_type)}
        data = {
            "document_type": document_type,
            "ocr_mode": ocr_mode,
        }

        try:
            resp = await client.post(url, headers=headers, files=files, data=data)
        except httpx.RequestError as exc:
            raise VendorError(
                "Verification Engine V2 is unavailable. Please try again later.",
                "PAPERWORK_UNAVAILABLE",
            ) from exc

        if resp.status_code in (401, 403):
            raise VendorError(
                "Verification Engine V2 authentication failed. Check engine credentials.",
                "PAPERWORK_AUTH_FAILED",
            )
        if resp.status_code >= 400:
            detail = _extract_vendor_message(resp)
            raise VendorError(
                detail or "Verification Engine V2 upload failed.",
                "PAPERWORK_UPLOAD_FAILED",
            )

        try:
            payload = resp.json()
            job_id = payload["job_id"]
        except (KeyError, TypeError, ValueError) as exc:
            raise VendorError(
                "Verification Engine V2 returned an unexpected upload response.",
                "PAPERWORK_UNEXPECTED_RESPONSE",
            ) from exc

        return str(job_id)

    async def _poll(self, client: httpx.AsyncClient, job_id: str) -> dict:
        status_url = f"{self._base_url}/api/v1/fraud-detection/status/{job_id}"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
        }

        for _ in range(_MAX_POLL_ATTEMPTS):
            try:
                resp = await client.get(status_url, headers=headers)
            except httpx.RequestError as exc:
                raise VendorError(
                    "Verification Engine V2 is unavailable. Please try again later.",
                    "PAPERWORK_UNAVAILABLE",
                ) from exc

            if resp.status_code in (401, 403):
                raise VendorError(
                    "Verification Engine V2 authentication failed. Check engine credentials.",
                    "PAPERWORK_AUTH_FAILED",
                )
            if resp.status_code >= 400:
                detail = _extract_vendor_message(resp)
                raise VendorError(
                    detail or f"Verification Engine V2 status check failed (HTTP {resp.status_code}).",
                    "PAPERWORK_API_ERROR",
                )

            try:
                payload = resp.json()
            except ValueError as exc:
                raise VendorError(
                    "Verification Engine V2 returned an unexpected status response.",
                    "PAPERWORK_UNEXPECTED_RESPONSE",
                ) from exc

            status = payload.get("status")
            if status == "completed":
                return payload
            if status == "failed":
                error = payload.get("error") or "Verification Engine V2 analysis failed."
                raise VendorError(str(error), "PAPERWORK_ANALYSIS_FAILED")

            await asyncio.sleep(_POLL_INTERVAL)

        raise VendorError(
            f"Verification Engine V2 did not complete analysis within {_MAX_POLL_ATTEMPTS * _POLL_INTERVAL}s.",
            "PAPERWORK_TIMEOUT",
        )


def _detect_content_type(content: bytes, filename: str) -> str:
    if content[:4] == b"%PDF":
        return "application/pdf"
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if content[:2] == b"\xff\xd8":
        return "image/jpeg"
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def _extract_vendor_message(response: httpx.Response) -> str | None:
    try:
        payload = response.json()
    except Exception:
        return None
    if isinstance(payload, dict):
        for key in ("error", "message", "detail"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None
