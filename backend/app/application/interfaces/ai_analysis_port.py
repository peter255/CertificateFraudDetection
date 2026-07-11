from __future__ import annotations

from typing import Protocol

from app.domain.entities.certificate import Certificate
from app.domain.entities.verification_report import VendorFinding


class IAiAnalysisPort(Protocol):
    """
    Outbound port for the AI narrative analysis adapter.

    Receives the original certificate and all vendor findings, then returns
    a human-readable summary string. Azure OpenAI is the expected implementor.
    """

    async def analyze(self, certificate: Certificate, findings: tuple[VendorFinding, ...]) -> str: ...
