from __future__ import annotations

from typing import Protocol

from app.application.dto.pdf_structure import PdfMetadata


class IPdfMetadataPort(Protocol):
    """Outbound port for PDF metadata extraction from document bytes."""

    def extract(
        self,
        content: bytes,
        *,
        filename: str,
        file_size: int | None = None,
    ) -> PdfMetadata: ...
