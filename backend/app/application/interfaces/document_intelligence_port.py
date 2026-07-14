from __future__ import annotations

from typing import Protocol

from app.application.dto.pdf_structure import OcrExtractedFields


class IDocumentIntelligencePort(Protocol):
    """Outbound port for Azure Document Intelligence OCR / field extraction."""

    def is_configured(self) -> bool: ...

    async def extract_fields(
        self,
        content: bytes,
        *,
        filename: str,
        content_type: str | None = None,
    ) -> OcrExtractedFields: ...
