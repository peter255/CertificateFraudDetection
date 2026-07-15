from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.application.dto.pdf_structure import PdfStructureAnalyzeResponse
from app.application.services.ai_probability_enrichment import AiProbabilityEnrichmentService
from app.application.services.ai_summary_enrichment import AiSummaryEnrichmentService
from app.application.services.pdf_structure.metadata_compare import (
    build_metadata_compare_summary,
    find_vendor_pdf_metadata,
)
from app.application.services.pdf_structure_enrichment import PdfStructureEnrichmentService
from app.infrastructure.vendors.truthscan.client import TruthScanClient
from app.infrastructure.vendors.truthscan.dependencies import provide_truthscan_client
from app.infrastructure.vendors.truthscan.models import TruthScanSignal, TruthScanVerifyResponse
from app.presentation.dependencies.ai_probability import (
    provide_ai_probability_enrichment,
    provide_ai_summary_enrichment,
)
from app.presentation.dependencies.pdf_structure import provide_pdf_structure_enrichment

router = APIRouter(prefix="/vendors/v1", tags=["vendors:v1"])


def _attach_pdf_structure_to_context(
    enrichment_context: dict[str, Any],
    analysis: PdfStructureAnalyzeResponse,
    *,
    cross_check_summary: str | None,
) -> None:
    """Augment executive-summary context with PDF Structure metadata + findings."""
    ocr = analysis.ocr_fields
    if ocr is not None:
        enrichment_context["ocr_fields"] = ocr.model_dump(exclude={"raw", "detected_text"})
    if analysis.pdf_metadata is not None:
        enrichment_context["pdf_metadata"] = analysis.pdf_metadata.model_dump()
    enrichment_context["pdf_structure_findings"] = [
        {
            "rule_id": item.rule_id,
            "severity": item.severity,
            "status": item.status,
            "title": item.title,
            "description": item.description,
        }
        for item in analysis.findings[:16]
    ]
    enrichment_context["pdf_structure_sources"] = analysis.sources
    if cross_check_summary:
        enrichment_context["pdf_structure_summary"] = cross_check_summary
    elif analysis.summary:
        enrichment_context["pdf_structure_summary"] = analysis.summary


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
    pdf_structure_service: PdfStructureEnrichmentService = Depends(provide_pdf_structure_enrichment),
) -> TruthScanVerifyResponse:
    raw_content = await file.read()
    filename = file.filename or "certificate.bin"
    resolved_holder = holder_name or file.filename or "Unknown"
    resolved_issuer = issuer_name or "Unknown"

    pdf_structure_task = asyncio.create_task(
        pdf_structure_service.enrich(
            content=raw_content,
            filename=filename,
            content_type=file.content_type,
        )
    )

    try:
        response = await client.verify(
            raw_content,
            filename=filename,
            document_type=document_type,
            holder_name=resolved_holder,
            issuer_name=resolved_issuer,
        )
    except Exception:
        pdf_structure_task.cancel()
        raise

    analysis = response.analysis
    enrichment_context: dict[str, Any] = {
        "engine": "v1",
        "verdict": response.overall_status or response.final_result,
        "final_result": response.final_result,
        "overall_status": response.overall_status,
        "raw_score": response.raw_score,
        "risk_score": response.raw_score,
        "fraud_score": response.raw_score,
        "ml_label": analysis.ml_label,
        "ml_score": analysis.ml_score,
        "ocr_label": analysis.ocr_label,
        "ocr_score": analysis.ocr_score,
        "key_indicators": analysis.key_indicators,
        "visual_patterns": analysis.visual_patterns,
        "metadata_notes": analysis.metadata_notes,
        "reasoning": analysis.reasoning,
        "document_type": document_type,
        "signals": [signal.model_dump(exclude_none=True) for signal in response.signals[:16]],
        "has_localized_visual_evidence": False,
        "localized_visual_count": 0,
        "vendor_identity": {
            "holder_name": resolved_holder,
            "issuer_name": resolved_issuer,
        },
        "holder_name": resolved_holder,
        "issuer_name": resolved_issuer,
    }

    signal_payloads = [signal.model_dump(exclude_none=True) for signal in response.signals]
    v1_context = {
        "verdict": response.overall_status,
        "document_type": response.document_type if hasattr(response, "document_type") else document_type,
        "has_localized_visual_evidence": False,
        "localized_visual_count": 0,
        "fraud_score": response.raw_score,
        "risk_score": response.raw_score,
    }

    (
        (ai_probability, ai_probability_source),
        text_manipulation_summary,
        image_manipulation_summary,
        pdf_structure_analysis,
    ) = await asyncio.gather(
        ai_probability_service.enrich(
            document_content=raw_content,
            filename=filename,
            vendor_payloads=[
                analysis.model_dump(),
                analysis.raw_query_response,
            ],
            raw_score=response.raw_score,
            context=enrichment_context,
        ),
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
        pdf_structure_task,
    )

    metadata_summary: str | None = None
    if pdf_structure_analysis is not None:
        vendor_pdf_metadata = find_vendor_pdf_metadata(
            analysis.raw_query_response,
            analysis.model_dump(),
        )
        metadata_summary = build_metadata_compare_summary(
            vendor_pdf_metadata,
            pdf_structure_analysis.pdf_metadata,
        )
        _attach_pdf_structure_to_context(
            enrichment_context,
            pdf_structure_analysis,
            cross_check_summary=metadata_summary,
        )

    ai_summary = await ai_summary_service.enrich(context=enrichment_context)

    updates: dict = {
        "ai_summary": ai_summary,
        "text_manipulation_summary": text_manipulation_summary,
        "image_manipulation_summary": image_manipulation_summary,
    }
    if ai_probability is not None:
        updates["ai_probability"] = ai_probability
        updates["ai_probability_source"] = ai_probability_source

    if pdf_structure_analysis is not None:
        pdf_updates = PdfStructureEnrichmentService.as_v1_updates(pdf_structure_analysis)
        updates["pdf_structure_summary"] = metadata_summary or pdf_updates["pdf_structure_summary"]
        updates["pdf_structure_findings"] = pdf_updates["pdf_structure_findings"]
        pdf_signals = [
            TruthScanSignal.model_validate(item)
            for item in pdf_updates["pdf_structure_signals"]
        ]
        if pdf_signals:
            updates["signals"] = [*response.signals, *pdf_signals]

    return response.model_copy(update=updates)
