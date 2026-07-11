from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.domain.enums.vendor_name import VendorName
from app.domain.enums.verification_status import VerificationStatus
from app.domain.value_objects.certificate_id import CertificateId


@dataclass(frozen=True)
class VendorFinding:
    """
    The result returned by a single verification vendor.

    confidence_score is expected to be in the range [0.0, 1.0].
    """

    vendor: VendorName
    status: VerificationStatus
    confidence_score: float
    raw_response: dict


@dataclass(frozen=True)
class VerificationReport:
    """
    Aggregate root for the outcome of a full certificate verification run.

    Combines individual vendor findings and an AI-generated narrative summary
    into a single authoritative result.
    """

    certificate_id: CertificateId
    overall_status: VerificationStatus
    vendor_findings: tuple[VendorFinding, ...]
    ai_summary: str
    verified_at: datetime = field(default_factory=datetime.utcnow)
