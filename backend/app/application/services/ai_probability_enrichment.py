from __future__ import annotations

from typing import Any

from app.application.interfaces.ai_analysis_port import IAiAnalysisPort
from app.infrastructure.ai.ai_probability_extractor import extract_vendor_ai_probability
from app.shared.logging.logger import get_logger

logger = get_logger(__name__)


class AiProbabilityEnrichmentService:
    """
    Resolve AI probability for a verification response.

    Priority:
      1. Explicit vendor AI probability fields in the payload.
      2. Engine V1 Core AI score (`raw_score` / `/query.result`).
      3. Azure OpenAI estimate when configured and no vendor probability exists.
    """

    def __init__(self, ai_client: IAiAnalysisPort) -> None:
        self._ai_client = ai_client

    async def enrich(
        self,
        *,
        document_content: bytes,
        filename: str,
        vendor_payloads: list[dict[str, Any] | None],
        raw_score: float | None = None,
        context: dict[str, Any] | None = None,
        allow_azure_estimate: bool = True,
    ) -> tuple[float | None, str | None]:
        vendor_probability = extract_vendor_ai_probability(*vendor_payloads)
        if vendor_probability is not None:
            return vendor_probability, "vendor"

        if raw_score is not None:
            score = _to_score_100(raw_score)
            if score is not None:
                return score, "vendor"

        # Verify fast-path: skip multimodal Azure estimate (often 10–20s).
        if not allow_azure_estimate:
            return None, None

        if not self._ai_client.is_configured():
            return None, None

        try:
            estimated = await self._ai_client.estimate_ai_probability(
                document_content=document_content,
                filename=filename,
                context=context or {},
            )
        except Exception as exc:  # noqa: BLE001 — optional enrichment must not fail verify
            logger.warning("Azure OpenAI AI probability estimation failed: %s", exc)
            return None, None

        if estimated is None:
            return None, None

        return estimated, "azure_openai"


def _to_score_100(raw: float | int | None) -> float | None:
    if raw is None:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if value < 0:
        return None
    if value <= 1:
        return round(min(100.0, max(0.0, value * 100.0)), 1)
    return round(min(100.0, max(0.0, value)), 1)
