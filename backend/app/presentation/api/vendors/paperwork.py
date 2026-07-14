from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.application.services.ai_probability_enrichment import AiProbabilityEnrichmentService
from app.application.services.ai_summary_enrichment import AiSummaryEnrichmentService
from app.infrastructure.vendors.paperwork.client import PaperworkClient
from app.infrastructure.vendors.paperwork.dependencies import provide_paperwork_client
from app.infrastructure.vendors.paperwork.models import PaperworkVerifyResponse
from app.presentation.dependencies.ai_probability import (
    provide_ai_probability_enrichment,
    provide_ai_summary_enrichment,
)

router = APIRouter(prefix="/vendors/v2", tags=["vendors:v2"])


@router.post(
    "/verify",
    response_model=PaperworkVerifyResponse,
    summary="Verify a document with Verification Engine V2",
    description=(
        "Upload a document for Verification Engine V2 fraud detection. "
        "Returns the Engine V2 response model."
    ),
)
async def verify_with_engine_v2(
    file: UploadFile = File(..., description="Document file (PDF, PNG, or JPEG)."),
    document_type: str = Form(
        default="auto",
        description='Document type hint. Use "auto" unless the exact class is known.',
    ),
    ocr_mode: str = Form(
        default="auto",
        description='OCR mode. Use "auto" unless a specific mode is required.',
    ),
    client: PaperworkClient = Depends(provide_paperwork_client),
    ai_probability_service: AiProbabilityEnrichmentService = Depends(provide_ai_probability_enrichment),
    ai_summary_service: AiSummaryEnrichmentService = Depends(provide_ai_summary_enrichment),
) -> PaperworkVerifyResponse:
    raw_content = await file.read()
    response = await client.verify(
        raw_content,
        filename=file.filename or "certificate.bin",
        document_type=document_type or "auto",
        ocr_mode=ocr_mode or "auto",
    )

    enrichment_context = {
        "engine": "v2",
        "verdict": response.verdict,
        "fraud_types": response.fraud_types,
        "fraud_score": response.fraud_score,
        "risk_level": response.risk_level,
        "layer_details": response.layer_details,
        "signals": [signal.model_dump(exclude_none=True) for signal in response.signals[:16]],
    }

    ai_probability, ai_probability_source = await ai_probability_service.enrich(
        document_content=raw_content,
        filename=file.filename or "certificate.bin",
        vendor_payloads=[
            response.layer_details,
            response.engine_results,
            response.classification,
            response.pdf_fraud_subscores,
            response.engine_scores,
            response.raw_result,
        ],
        context={
            **enrichment_context,
            # Probability estimator may still use vendor narrative as a weak hint.
            "executive_summary": response.executive_summary,
        },
    )

    ai_summary = await ai_summary_service.enrich(context=enrichment_context)

    updates: dict = {
        # Always overwrite vendor executive_summary — it often restates recommendations.
        "executive_summary": ai_summary,
    }
    if ai_probability is not None:
        updates["ai_probability"] = ai_probability
        updates["ai_probability_source"] = ai_probability_source

    return response.model_copy(update=updates)
