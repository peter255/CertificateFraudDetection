from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class VendorFindingDTO(BaseModel):
    """Serialisable representation of a single vendor's verification outcome."""

    vendor: str
    status: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)


class SignalDTO(BaseModel):
    """A single forensic signal produced during verification."""

    id: str
    category: str
    description: str
    status: str  # "pass" | "warning" | "fail"


class FindingDTO(BaseModel):
    """A titled finding entry in the executive report."""

    title: str
    detail: str


class ReportDTO(BaseModel):
    """Structured executive report summarising the verification outcome."""

    summary: str
    risk_level: str          # "low" | "medium" | "high"
    risk_score: int          # 0–100
    findings: list[FindingDTO]
    recommendation: str


class VerifyCertificateResponse(BaseModel):
    """
    Output DTO returned by the certificate verification use case.

    This is the only type the presentation layer receives;
    no domain objects cross the use case boundary.
    """

    certificate_id: str
    overall_status: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    document_type: str
    holder_name: str
    issuer_name: str
    vendor_findings: list[VendorFindingDTO]
    signals: list[SignalDTO]
    report: ReportDTO
    ai_summary: str
    verified_at: datetime
