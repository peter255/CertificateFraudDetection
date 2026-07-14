from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.application.services.ai_probability_enrichment import AiProbabilityEnrichmentService
from app.application.services.ai_summary_enrichment import AiSummaryEnrichmentService
from app.infrastructure.vendors.truthscan.client import TruthScanClient
from app.infrastructure.vendors.truthscan.dependencies import provide_truthscan_client
from app.infrastructure.vendors.truthscan.models import TruthScanVerifyResponse
from app.presentation.dependencies.ai_probability import (
    provide_ai_probability_enrichment,
    provide_ai_summary_enrichment,
)

router = APIRouter(prefix="/vendors/v1", tags=["vendors:v1"])


@router.post(
    "/verify",
    response_model=TruthScanVerifyResponse,
    summary="Verify a document with Verification Engine V1",
    description=(
        "Upload a certificate file for Verification Engine V1 authenticity checks. "
        "Returns the Engine V1 response model."
    ),
)
async def verify_with_engine_v1(
    file: UploadFile = File(..., description="Certificate file (PDF, PNG, or JPEG)."),
    holder_name: str = Form(default="Unknown", description="Full name of the certificate holder."),
    issuer_name: str = Form(default="Unknown", description="Name of the issuing authority."),
    document_type: str = Form(
        default="academic_certificate",
        description="Document category: academic_certificate | professional_license | identity_document | corporate_document",
    ),
    client: TruthScanClient = Depends(provide_truthscan_client),
    ai_probability_service: AiProbabilityEnrichmentService = Depends(provide_ai_probability_enrichment),
    ai_summary_service: AiSummaryEnrichmentService = Depends(provide_ai_summary_enrichment),
) -> TruthScanVerifyResponse:
    raw_content = await file.read()
    response = await client.verify(
        raw_content,
        filename=file.filename or "certificate.bin",
        document_type=document_type,
        holder_name=holder_name or file.filename or "Unknown",
        issuer_name=issuer_name or "Unknown",
    )

    analysis = response.analysis
    enrichment_context = {
        "engine": "v1",
        "final_result": response.final_result,
        "overall_status": response.overall_status,
        "raw_score": response.raw_score,
        "ml_label": analysis.ml_label,
        "ml_score": analysis.ml_score,
        "ocr_label": analysis.ocr_label,
        "ocr_score": analysis.ocr_score,
        "key_indicators": analysis.key_indicators,
        "visual_patterns": analysis.visual_patterns,
        "metadata_notes": analysis.metadata_notes,
        "reasoning": analysis.reasoning,
        "signals": [signal.model_dump(exclude_none=True) for signal in response.signals[:16]],
    }

    signal_payloads = [signal.model_dump(exclude_none=True) for signal in response.signals]
    v1_context = {
        "verdict": response.overall_status,
        "document_type": response.document_type,
    }

    (
        (ai_probability, ai_probability_source),
        ai_summary,
        text_manipulation_summary,
        image_manipulation_summary,
    ) = await asyncio.gather(
        ai_probability_service.enrich(
            document_content=raw_content,
            filename=file.filename or "certificate.bin",
            vendor_payloads=[
                analysis.model_dump(),
                analysis.raw_query_response,
            ],
            raw_score=response.raw_score,
            context=enrichment_context,
        ),
        ai_summary_service.enrich(context=enrichment_context),
        ai_summary_service.enrich_text_manipulation(
            signals=signal_payloads,
            context=v1_context,
        ),
        ai_summary_service.enrich_image_manipulation(
            signals=signal_payloads,
            visual_evidence=[
                {"description": pattern, "category": "Visual Pattern"}
                for pattern in (analysis.visual_patterns or [])
                if isinstance(pattern, str) and pattern.strip()
            ],
            context=v1_context,
        ),
    )

    updates: dict = {
        "ai_summary": ai_summary,
        "text_manipulation_summary": text_manipulation_summary,
        "image_manipulation_summary": image_manipulation_summary,
    }
    if ai_probability is not None:
        updates["ai_probability"] = ai_probability
        updates["ai_probability_source"] = ai_probability_source

    return response.model_copy(update=updates)
