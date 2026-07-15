from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TruthScanSignal(BaseModel):
    id: str
    category: str
    description: str
    status: str  # "pass" | "warning" | "fail"


class TruthScanFinding(BaseModel):
    title: str
    detail: str


class TruthScanReport(BaseModel):
    summary: str
    risk_level: str
    risk_score: int
    findings: list[TruthScanFinding]
    recommendation: str


class TruthScanAnalysisDetails(BaseModel):
    """Everything useful returned by Engine V1 /query — nothing discarded."""

    verdict_label: str = ""
    raw_score: float = 0.0
    reasoning: str = ""
    key_indicators: list[str] = Field(default_factory=list)
    visual_patterns: list[str] = Field(default_factory=list)
    vendor_recommendations: list[str] = Field(default_factory=list)
    heatmap_url: str | None = None
    analysis_agreement: str = ""
    detection_step: Any = None
    is_valid: bool | None = None
    metadata_notes: list[str] = Field(default_factory=list)
    ocr_label: str | None = None
    ocr_score: float | None = None
    ml_label: str | None = None
    ml_score: float | None = None
    analysis_status: str = ""
    job_id: str = ""
    # Vendor optional arrays (watermark / blur / screen_recapture, …).
    warnings: list[dict[str, Any]] = Field(default_factory=list)
    # Full /query payload — preserves any undocumented nested fields.
    raw_query_response: dict[str, Any] = Field(default_factory=dict)


class TruthScanVerifyResponse(BaseModel):
    """
    Engine V1 verification response.

    Shape is intentionally Engine V1-specific. Other engines must not share this model.
    """

    vendor: str = "v1"
    certificate_id: str
    job_id: str
    overall_status: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    final_result: str
    raw_score: float
    document_type: str
    holder_name: str
    issuer_name: str
    analysis: TruthScanAnalysisDetails
    signals: list[TruthScanSignal]
    report: TruthScanReport
    ai_summary: str
    verified_at: datetime
    duration_ms: int
    ai_probability: float | None = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="0–100 AI-generation probability from vendor fields or Azure OpenAI fallback.",
    )
    ai_probability_source: str | None = Field(
        default=None,
        description='"vendor" when taken from engine fields; "azure_openai" when estimated.',
    )
    text_manipulation_summary: str | None = Field(
        default=None,
        description="Azure OpenAI plain-English summary of Text Manipulation findings.",
    )
    image_manipulation_summary: str | None = Field(
        default=None,
        description="Azure OpenAI plain-English summary of Image Manipulation findings.",
    )
    pdf_structure_summary: str | None = Field(
        default=None,
        description=(
            "Metadata-only comparison of vendor PDF metadata dates/fields vs "
            "pdf-structure analysis (falls back to local PDF Structure summary)."
        ),
    )
    pdf_structure_findings: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Structured PDF structure forensic findings.",
    )
    display_risk_score: int | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Azure OpenAI overall Risk Score (0–100) for the results dashboard.",
    )
    fraud_probability: int | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Azure OpenAI Fraud Probability (0–100) for the results dashboard.",
    )
    text_logic_score: int | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Azure OpenAI Text Logic score (0–100).",
    )
    image_forensics_score: int | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Azure OpenAI Image Forensics score (0–100).",
    )
    file_structure_score: int | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Azure OpenAI File Structure score (0–100).",
    )
