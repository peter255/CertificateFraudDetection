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
