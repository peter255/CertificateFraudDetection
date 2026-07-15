from __future__ import annotations

from typing import Any

from app.application.dto.pdf_structure import PdfStructureAnalyzeResponse
from app.application.interfaces.pdf_structure_analysis_port import IPdfStructureAnalysisPort
from app.application.services.pdf_structure.signal_mapper import (
    build_structural_profile_update,
    findings_to_signal_payloads,
    findings_to_v1_signals,
)
from app.shared.logging.logger import get_logger

logger = get_logger(__name__)


class PdfStructureEnrichmentService:
    """
    Optional enrichment wrapper around PdfStructureAnalysisService.

    Never raises to callers — verify endpoints must remain resilient.
    """

    def __init__(self, analyzer: IPdfStructureAnalysisPort) -> None:
        self._analyzer = analyzer

    async def enrich(
        self,
        *,
        content: bytes,
        filename: str,
        content_type: str | None = None,
    ) -> PdfStructureAnalyzeResponse | None:
        try:
            return await self._analyzer.analyze(
                content,
                filename=filename,
                content_type=content_type,
                # Verify path: keep DI layout + metadata/rules; skip slow LLM consistency.
                include_llm=False,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("PDF structure enrichment failed: %s", exc)
            return None

    @staticmethod
    def as_v2_updates(analysis: PdfStructureAnalyzeResponse) -> dict[str, Any]:
        signal_payloads = findings_to_signal_payloads(analysis.findings)
        profile = build_structural_profile_update(analysis)
        return {
            "pdf_structure_summary": analysis.summary,
            "pdf_structure_findings": [item.model_dump() for item in analysis.findings],
            "pdf_structure_signals": signal_payloads,
            "pdf_structure_profile": profile,
            "ocr_fields": analysis.ocr_fields.model_dump() if analysis.ocr_fields else None,
            "pdf_metadata": analysis.pdf_metadata.model_dump() if analysis.pdf_metadata else None,
        }

    @staticmethod
    def as_v1_updates(analysis: PdfStructureAnalyzeResponse) -> dict[str, Any]:
        return {
            "pdf_structure_summary": analysis.summary,
            "pdf_structure_findings": [item.model_dump() for item in analysis.findings],
            "pdf_structure_signals": findings_to_v1_signals(analysis.findings),
            "pdf_structure_profile": build_structural_profile_update(analysis),
        }
