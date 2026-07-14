from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.application.dto.pdf_structure import OcrExtractedFields, PdfMetadata
from app.application.services.pdf_structure.date_utils import parse_flexible_datetime

_PARSED_DATES_KEY = "_parsed_dates"


@dataclass(frozen=True)
class PdfStructureContext:
    """Immutable analysis context shared by forensic rules and the LLM stage."""

    ocr: OcrExtractedFields
    metadata: PdfMetadata
    filename: str = ""
    content_type: str | None = None
    extras: dict[str, Any] = field(default_factory=dict)

    def parsed_dates(self) -> dict[str, datetime | None]:
        """Parse date fields once per context (cached on extras)."""
        cached = self.extras.get(_PARSED_DATES_KEY)
        if isinstance(cached, dict):
            return cached

        parsed = {
            "creation_date": parse_flexible_datetime(self.metadata.creation_date),
            "modification_date": parse_flexible_datetime(self.metadata.modification_date),
            "award_date": parse_flexible_datetime(self.ocr.award_date),
            "issue_date": parse_flexible_datetime(self.ocr.issue_date),
            "expiration_date": parse_flexible_datetime(self.ocr.expiration_date),
        }
        self.extras[_PARSED_DATES_KEY] = parsed
        return parsed
