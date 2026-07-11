from __future__ import annotations

from app.domain.entities.verification_report import VerificationReport
from app.domain.repositories.verification_report_repository import IVerificationReportRepository
from app.domain.value_objects.certificate_id import CertificateId


class VerificationReportRepositoryImpl(IVerificationReportRepository):
    """
    Concrete IVerificationReportRepository backed by the configured persistence store.

    Each report is keyed on certificate_id. Upsert semantics handle
    re-verification without creating duplicate records.
    """

    async def save(self, report: VerificationReport) -> None:
        raise NotImplementedError

    async def find_by_certificate_id(self, certificate_id: CertificateId) -> VerificationReport | None:
        raise NotImplementedError
