from __future__ import annotations

from typing import Protocol

from app.application.dto.pdf_structure import PdfStructureAnalyzeResponse


class IPdfStructureAnalysisPort(Protocol):
    """
    Application port for the forensic PDF Structure Analysis pipeline.

    Combines OCR fields, PDF metadata, deterministic rules, and optional LLM checks.
    """

    def is_available(self) -> bool: ...

    async def analyze(
        self,
        content: bytes,
        *,
        filename: str,
        content_type: str | None = None,
        include_llm: bool = True,
    ) -> PdfStructureAnalyzeResponse: ...
