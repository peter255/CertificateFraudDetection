from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PaperworkSignal(BaseModel):
    """Engine V2 signal / field_evidence item — preserves engine fields."""

    type: str | None = None
    check: str | None = None
    layer: str | None = None
    stage: str | None = None
    engine: str | None = None
    detector: str | None = None
    severity: str | None = None
    confidence: float | None = None
    description: str | None = None
    engine_label: str | None = None
    detector_label: str | None = None
    evidence_class: str | None = None
    id: str | None = None
    bbox: list[int] | None = None
    page: int | None = None
    image_width: int | None = None
    image_height: int | None = None
    bbox_area_ratio: float | None = None
    location: str | None = None
    related_bboxes: list[dict[str, Any]] | None = None
    bbox_source: str | None = None
    field: str | None = None
    field_label: str | None = None
    field_fit_score: float | None = None
    field_importance: float | None = None
    field_assignment_source: str | None = None
    field_assignment_confidence: float | None = None
    source: str | None = None
    fraud_type: str | None = None
    score_role: str | None = None
    generator: str | None = None
    issuer_name: str | None = None
    issuer_category: str | None = None
    extras: dict[str, Any] = Field(default_factory=dict)


class PaperworkFraud(BaseModel):
    color: str | None = None
    score: float | None = None
    score_100: float | None = None
    types: list[str] = Field(default_factory=list)
    verdict: str | None = None
    recommendation: str | None = None


class PaperworkVerifyResponse(BaseModel):
    """
    Engine V2 verification response.

    Exposes the full fraud-detection result surface — not a shared DTO.
    """

    vendor: str = "v2"
    job_id: str
    status: str
    progress: int | None = None
    progress_message: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    completed_at: str | None = None

    verdict: str
    fraud_color: str | None = None
    fraud_score: float | None = None
    risk_level: str | None = None
    fraud_types: list[str] = Field(default_factory=list)
    recommendation: str | None = None
    is_scan: bool | None = None
    file_kind: str | None = None
    document_type: str | None = None

    fraud: PaperworkFraud | None = None
    signals: list[PaperworkSignal] = Field(default_factory=list)
    field_evidence: list[PaperworkSignal] = Field(default_factory=list)
    analysis_flow: list[dict[str, Any]] = Field(default_factory=list)
    engine_scores: dict[str, Any] = Field(default_factory=dict)
    layer_details: dict[str, Any] = Field(default_factory=dict)
    classification: dict[str, Any] = Field(default_factory=dict)
    engine_results: dict[str, Any] = Field(default_factory=dict)
    raw_result: dict[str, Any] = Field(default_factory=dict)

    verified_at: datetime
    duration_ms: int
