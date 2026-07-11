from __future__ import annotations

from app.domain.entities.certificate import Certificate
from app.domain.entities.verification_report import VendorFinding
from app.infrastructure.configuration.settings import Settings


class PaperworkClient:
    """
    Adapter that satisfies IVendorVerificationPort by delegating to the Paperwork.to REST API.

    HTTP transport, retry logic, and response parsing will live here.
    No business logic is performed in this class; it translates between
    the Paperwork wire format and the VendorFinding domain object.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def verify(self, certificate: Certificate) -> VendorFinding:
        raise NotImplementedError
