from __future__ import annotations

from typing import Protocol

from app.domain.entities.certificate import Certificate
from app.domain.entities.verification_report import VendorFinding


class IVendorVerificationPort(Protocol):
    """
    Outbound port for a verification vendor adapter.

    Each vendor (TruthScan, Paperwork) provides a concrete implementation.
    The application layer depends on this interface only; never on a concrete client.
    """

    async def verify(self, certificate: Certificate) -> VendorFinding: ...
