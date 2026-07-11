from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.entities.verification_report import VendorFinding
from app.domain.enums.verification_status import VerificationStatus


class IFraudScoringService(ABC):
    """
    Domain service that computes a single authoritative VerificationStatus
    from the collection of raw vendor findings.

    This logic lives in the domain because it encodes a core business rule:
    how conflicting vendor opinions are resolved into one verdict.
    Implementations must not call external services.
    """

    @abstractmethod
    def compute_overall_status(self, findings: tuple[VendorFinding, ...]) -> VerificationStatus: ...
