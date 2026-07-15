from __future__ import annotations

import asyncio
from typing import Any
from urllib.parse import urlparse

import httpx

from app.application.dto.pdf_structure import OcrExtractedFields
from app.infrastructure.azure_document_intelligence.field_mapper import (
    map_document_intelligence_result,
)
from app.infrastructure.configuration.settings import Settings
from app.shared.exceptions.base import InfrastructureError
from app.shared.logging.logger import get_logger

logger = get_logger(__name__)

_API_VERSION = "2024-11-30"
_POLL_INTERVAL_SEC = 1.0
_MAX_POLLS = 90


class AzureDocumentIntelligenceClient:
    """
    Azure Document Intelligence adapter (REST / httpx).

    Implements IDocumentIntelligencePort for certificate OCR field extraction.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def is_configured(self) -> bool:
        return bool(
            self._settings.azure_document_intelligence_endpoint.strip()
            and self._settings.azure_document_intelligence_key.strip()
        )

    async def extract_fields(
        self,
        content: bytes,
        *,
        filename: str,
        content_type: str | None = None,
    ) -> OcrExtractedFields:
        if not self.is_configured():
            return OcrExtractedFields()

        endpoint = self._settings.azure_document_intelligence_endpoint.rstrip("/")
        # v4 (2024-11-30) retired prebuilt-document; layout + keyValuePairs replaces it.
        model_id = (
            self._settings.azure_document_intelligence_model.strip() or "prebuilt-layout"
        )
        if model_id == "prebuilt-document":
            logger.warning(
                "Model 'prebuilt-document' is retired in API %s; using prebuilt-layout "
                "with features=keyValuePairs instead.",
                _API_VERSION,
            )
            model_id = "prebuilt-layout"

        query = f"api-version={_API_VERSION}"
        if model_id == "prebuilt-layout":
            query += "&features=keyValuePairs"

        url = (
            f"{endpoint}/documentintelligence/documentModels/{model_id}:analyze"
            f"?{query}"
        )

        headers = {
            "Ocp-Apim-Subscription-Key": self._settings.azure_document_intelligence_key,
            "Content-Type": content_type or _detect_content_type(content, filename),
        }

        timeout = httpx.Timeout(self._settings.azure_document_intelligence_timeout)

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, headers=headers, content=content)
            if response.status_code >= 400:
                detail = response.text[:500]
                logger.warning(
                    "Azure Document Intelligence analyze failed (%s): %s",
                    response.status_code,
                    detail,
                )
                raise InfrastructureError(
                    f"Azure Document Intelligence analyze failed: {response.status_code}",
                    "AZURE_DI_ANALYZE_FAILED",
                )

            operation_url = response.headers.get("operation-location") or response.headers.get(
                "Operation-Location"
            )
            if not operation_url:
                # Some responses may inline the result.
                body = response.json()
                analyze_result = _coerce_analyze_result(body)
                if analyze_result is not None:
                    return map_document_intelligence_result(analyze_result)
                raise InfrastructureError(
                    "Azure Document Intelligence response missing Operation-Location",
                    "AZURE_DI_MISSING_OPERATION",
                )

            result_body = await self._poll_result(client, operation_url)

        analyze_result = _coerce_analyze_result(result_body)
        if analyze_result is None:
            raise InfrastructureError(
                "Azure Document Intelligence result missing analyzeResult",
                "AZURE_DI_EMPTY_RESULT",
            )

        mapped = map_document_intelligence_result(analyze_result)
        logger.info(
            "Azure DI OCR extracted fields for %s (kv=%s)",
            filename,
            len(mapped.key_value_pairs),
        )
        return mapped

    async def _poll_result(
        self,
        client: httpx.AsyncClient,
        operation_url: str,
    ) -> dict[str, Any]:
        headers = {
            "Ocp-Apim-Subscription-Key": self._settings.azure_document_intelligence_key,
        }

        # Keep polling on the same host as configured endpoint when possible.
        poll_url = operation_url
        parsed_op = urlparse(operation_url)
        parsed_endpoint = urlparse(
            self._settings.azure_document_intelligence_endpoint.rstrip("/")
        )
        if parsed_op.netloc and parsed_endpoint.netloc and parsed_op.netloc != parsed_endpoint.netloc:
            logger.warning(
                "Azure DI Operation-Location host (%s) differs from configured endpoint host (%s)",
                parsed_op.netloc,
                parsed_endpoint.netloc,
            )

        for _ in range(_MAX_POLLS):
            response = await client.get(poll_url, headers=headers)
            if response.status_code >= 400:
                raise InfrastructureError(
                    f"Azure Document Intelligence poll failed: {response.status_code}",
                    "AZURE_DI_POLL_FAILED",
                )
            body = response.json()
            status = str(body.get("status") or "").lower()
            if status in {"succeeded", "partiallysucceeded"}:
                return body
            if status in {"failed", "canceled", "cancelled"}:
                error = body.get("error") or body.get("analyzeResult") or {}
                raise InfrastructureError(
                    f"Azure Document Intelligence analysis {status}: {error}",
                    "AZURE_DI_ANALYSIS_FAILED",
                )
            await asyncio.sleep(_POLL_INTERVAL_SEC)

        raise InfrastructureError(
            "Azure Document Intelligence analysis timed out",
            "AZURE_DI_TIMEOUT",
        )


def _coerce_analyze_result(body: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(body, dict):
        return None
    result = body.get("analyzeResult")
    if isinstance(result, dict):
        return result
    # Already an analyzeResult-shaped payload.
    if "pages" in body or "content" in body or "keyValuePairs" in body:
        return body
    return None


def _detect_content_type(content: bytes, filename: str) -> str:
    lower = filename.lower()
    if content.startswith(b"%PDF") or lower.endswith(".pdf"):
        return "application/pdf"
    if content.startswith(b"\x89PNG") or lower.endswith(".png"):
        return "image/png"
    if content[:3] == b"\xff\xd8\xff" or lower.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    return "application/octet-stream"
