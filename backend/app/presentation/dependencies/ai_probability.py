from __future__ import annotations

from fastapi import Depends

from app.application.interfaces.ai_analysis_port import IAiAnalysisPort
from app.application.services.ai_probability_enrichment import AiProbabilityEnrichmentService
from app.application.services.ai_summary_enrichment import AiSummaryEnrichmentService
from app.presentation.dependencies.container import provide_ai_client


def provide_ai_probability_enrichment(
    ai_client: IAiAnalysisPort = Depends(provide_ai_client),
) -> AiProbabilityEnrichmentService:
    return AiProbabilityEnrichmentService(ai_client=ai_client)


def provide_ai_summary_enrichment(
    ai_client: IAiAnalysisPort = Depends(provide_ai_client),
) -> AiSummaryEnrichmentService:
    return AiSummaryEnrichmentService(ai_client=ai_client)
