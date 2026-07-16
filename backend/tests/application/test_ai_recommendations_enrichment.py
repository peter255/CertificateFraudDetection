import asyncio
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

from app.application.dto.pdf_structure import PdfStructureFinding, PdfStructureAnalyzeResponse
from app.application.services.ai_summary_enrichment import AiSummaryEnrichmentService


def test_enrich_recommendations_uses_azure_when_available() -> None:
    ai_client = MagicMock()
    ai_client.is_configured.return_value = True
    ai_client.generate_recommendations = AsyncMock(
        return_value=[
            {
                "recommendation": "Cross-check holder name with issuer records.",
                "description": "OCR holder identity differs from embedded metadata.",
            }
        ]
    )
    service = AiSummaryEnrichmentService(ai_client)

    result = asyncio.run(
        service.enrich_recommendations(
            context={"verdict": "SUSPICIOUS", "vendor_flags": ["Date mismatch"]},
            use_llm=True,
        )
    )

    assert len(result) == 1
    assert result[0].recommendation.startswith("Cross-check holder name")
    assert "OCR holder identity" in result[0].description


def test_enrich_recommendations_falls_back_to_metadata_findings() -> None:
    ai_client = MagicMock()
    ai_client.is_configured.return_value = False
    service = AiSummaryEnrichmentService(ai_client)
    analysis = PdfStructureAnalyzeResponse(
        findings=[
            PdfStructureFinding(
                rule_id="PDF_EDITING_SOFTWARE_DETECTED",
                severity="warning",
                status="warning",
                title="Editing software detected in file metadata",
                description="The file producer references editing software.",
                recommendation="Review provenance and compare against issuer records.",
            )
        ],
        summary="Metadata warning.",
        analyzed_at=datetime.now(UTC),
        duration_ms=12,
        sources={"metadata": True},
    )

    result = asyncio.run(
        service.enrich_recommendations(
            context={"verdict": "SUSPICIOUS"},
            pdf_structure_analysis=analysis,
            use_llm=True,
        )
    )

    assert len(result) == 1
    assert result[0].description == "The file producer references editing software."
