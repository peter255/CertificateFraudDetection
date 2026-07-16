from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PdfStructureFinding(BaseModel):
    """Structured forensic finding produced by PDF Structure Analysis."""

    rule_id: str = Field(..., description="Stable identifier for the rule or LLM check.")
    severity: str = Field(..., description="info | warning | critical")
    status: str = Field(..., description="pass | warning | fail")
    title: str
    description: str
    evidence: dict[str, Any] = Field(default_factory=dict)
    recommendation: str = ""
    confidence: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Confidence in the finding (0–1).",
    )


class ReportRecommendation(BaseModel):
    """Action recommendation with optional forensic context for the report UI."""

    recommendation: str
    description: str = ""


class OcrExtractedFields(BaseModel):
    """Normalized certificate fields extracted from Azure Document Intelligence."""

    holder_name: str | None = None
    certificate_name: str | None = None
    issuer: str | None = None
    award_date: str | None = None
    issue_date: str | None = None
    expiration_date: str | None = None
    certificate_id: str | None = None
    qr_code: str | None = None
    detected_text: str | None = None
    key_value_pairs: dict[str, str] = Field(default_factory=dict)
    raw: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Full Azure Document Intelligence analyzeResult payload when available "
            "(pages, lines, words, polygons, boundingRegions, spans, etc.) — "
            "preserved for UI highlighting; not flattened away."
        ),
    )


class FileInformation(BaseModel):
    """Uploaded-file facts and extracted metadata for the File Information report section."""

    file_type: str
    file_size: str
    file_size_bytes: int
    num_pages: int = Field(default=1, ge=1)
    filename: str | None = None
    mime_type: str | None = None
    creation_date: str | None = None
    modification_date: str | None = None
    file_modified: str | None = None
    producer: str | None = None
    creator: str | None = None
    editing_producer: str | None = None
    pdf_version: str | None = None
    title: str | None = None
    author: str | None = None
    subject: str | None = None
    keywords: str | None = None
    is_pdf: bool | None = None
    parse_error: str | None = None
    document_properties: dict[str, Any] = Field(default_factory=dict)


class PdfMetadata(BaseModel):
    """Normalized PDF document metadata used by forensic rules."""

    file_type: str | None = None
    creation_date: str | None = None
    modification_date: str | None = None
    file_modified: str | None = Field(
        default=None,
        description="Filesystem last-modified timestamp when available (ISO).",
    )
    producer: str | None = None
    creator: str | None = None
    editing_producer: str | None = Field(
        default=None,
        description="Software inferred to have last edited the file (metadata.ipynb).",
    )
    pdf_version: str | None = None
    page_count: int | None = None
    file_size: int | None = None
    title: str | None = None
    author: str | None = None
    subject: str | None = None
    keywords: str | None = None
    document_properties: dict[str, Any] = Field(default_factory=dict)
    is_pdf: bool = False
    parse_error: str | None = None


class PdfStructureAnalyzeResponse(BaseModel):
    """API response for the standalone PDF Structure Analysis endpoint."""

    status: str = "completed"
    findings: list[PdfStructureFinding] = Field(default_factory=list)
    ocr_fields: OcrExtractedFields | None = None
    pdf_metadata: PdfMetadata | None = None
    summary: str | None = None
    analyzed_at: datetime
    duration_ms: int
    sources: dict[str, bool] = Field(
        default_factory=dict,
        description="Which pipeline stages contributed (ocr, metadata, rules, llm).",
    )
