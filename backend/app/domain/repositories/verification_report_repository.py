from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.entities.verification_report import VerificationReport
from app.domain.value_objects.certificate_id import CertificateId


class IVerificationReportRepository(ABC):
    """
    Abstract persistence contract for VerificationReport aggregates.

    One report is expected per certificate. Implementations handle
    upsert semantics for re-verification scenarios.
    """

    @abstractmethod
    async def save(self, report: VerificationReport) -> None: ...

    @abstractmethod
    async def find_by_certificate_id(self, certificate_id: CertificateId) -> VerificationReport | None: ...
