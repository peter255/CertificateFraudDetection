from __future__ import annotations

from app.domain.entities.certificate import Certificate
from app.domain.entities.verification_report import VendorFinding
from app.infrastructure.configuration.settings import Settings


class AzureOpenAIClient:
    """
    Adapter that satisfies IAiAnalysisPort by calling the Azure OpenAI chat completions endpoint.

    Prompt construction, token management, and response parsing will live here.
    This class must remain free of domain logic; it only speaks the Azure OpenAI wire protocol
    and maps the completion text to the string the application layer expects.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def analyze(self, certificate: Certificate, findings: tuple[VendorFinding, ...]) -> str:
        raise NotImplementedError
