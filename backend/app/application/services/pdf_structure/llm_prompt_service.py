from __future__ import annotations

from typing import Any, Mapping, Sequence

from app.application.dto.pdf_structure import (
    OcrExtractedFields,
    PdfMetadata,
    PdfStructureFinding,
)
from app.application.services.pdf_structure.prompt_builder import PdfForensicPromptBuilder
from app.application.services.pdf_structure.response_parser import (
    parse_logical_consistency_response,
    parse_summary_response,
)


class PdfStructureLlmPromptService:
    """
    PDF Structure LLM prompt facade.

    - Builds prompts via PdfForensicPromptBuilder (templates externalized)
    - Parses completions via response_parser
    """

    def __init__(self, prompt_builder: PdfForensicPromptBuilder | None = None) -> None:
        self._prompt_builder = prompt_builder or PdfForensicPromptBuilder()

    def build_logical_consistency_prompt(
        self,
        *,
        ocr: OcrExtractedFields | Mapping[str, Any],
        metadata: PdfMetadata | Mapping[str, Any],
        fraud_indicators: Sequence[PdfStructureFinding | Mapping[str, Any]] | None = None,
        # Backward-compatible alias for earlier call sites.
        rule_findings: Sequence[PdfStructureFinding | Mapping[str, Any]] | None = None,
    ) -> str:
        indicators = fraud_indicators if fraud_indicators is not None else rule_findings
        return self._prompt_builder.build_logical_consistency_prompt(
            ocr_result=ocr,
            metadata=metadata,
            fraud_indicators=indicators or [],
        )

    def build_summary_prompt(
        self,
        *,
        findings: Sequence[PdfStructureFinding | Mapping[str, Any]],
    ) -> str:
        return self._prompt_builder.build_findings_summary_prompt(findings=findings)

    def parse_logical_consistency_response(
        self,
        raw: str | None,
    ) -> tuple[list[PdfStructureFinding], str | None]:
        return parse_logical_consistency_response(raw)

    def parse_summary_response(self, raw: str | None) -> str | None:
        return parse_summary_response(raw)
