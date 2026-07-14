from __future__ import annotations

from typing import Any, Protocol

from app.domain.entities.certificate import Certificate
from app.domain.entities.verification_report import VendorFinding


class IAiAnalysisPort(Protocol):
    """
    Outbound port for the AI narrative analysis adapter.

    Receives the original certificate and all vendor findings, then returns
    a human-readable summary string. Azure OpenAI is the expected implementor.
    """

    def is_configured(self) -> bool: ...

    async def analyze(self, certificate: Certificate, findings: tuple[VendorFinding, ...]) -> str: ...

    async def generate_summary(
        self,
        *,
        context: dict[str, Any],
    ) -> str | None: ...

    async def estimate_ai_probability(
        self,
        *,
        document_content: bytes,
        filename: str,
        context: dict[str, Any],
    ) -> float | None: ...
