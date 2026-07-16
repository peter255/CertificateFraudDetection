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
from app.application.services.report_enrichment import build_report_enrichment
from app.application.services.vendor_flags import collect_vendor_flags_v2
from app.infrastructure.vendors.paperwork.client import PaperworkClient
from app.infrastructure.vendors.paperwork.dependencies import provide_paperwork_client
from app.infrastructure.vendors.paperwork.models import PaperworkSignal, PaperworkVerifyResponse
from app.presentation.dependencies.ai_probability import (
    provide_ai_probability_enrichment,
    provide_ai_summary_enrichment,
)
from app.presentation.dependencies.pdf_structure import provide_pdf_structure_enrichment

router = APIRouter(prefix="/vendors/v2", tags=["vendors:v2"])


def _is_localized_visual_payload(item: dict) -> bool:
    page = item.get("page", item.get("page_number"))
    try:
        page_num = int(page) if page is not None else 0
    except (TypeError, ValueError):
        return False
    if page_num < 1:
        return False
    bbox = item.get("bbox") or item.get("bounding_box") or item.get("box")
    if not isinstance(bbox, (list, tuple)) or len(bbox) < 4:
        return False
    try:
        coords = [float(v) for v in bbox[:4]]
    except (TypeError, ValueError):
        return False
    return any(abs(v) > 0 for v in coords)


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
    pdf_structure_service: PdfStructureEnrichmentService = Depends(provide_pdf_structure_enrichment),
) -> PaperworkVerifyResponse:
    raw_content = await file.read()
    filename = file.filename or "certificate.bin"

    # Overlap Azure DI / PDF structure with the vendor call (largest latency win).
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
            document_type=document_type or "auto",
            ocr_mode=ocr_mode or "auto",
        )
    except Exception:
        pdf_structure_task.cancel()
        raise

    signal_payloads = [signal.model_dump(exclude_none=True) for signal in response.signals]
    visual_payloads = [
        item.model_dump(exclude_none=True) for item in response.visual_evidence
    ]
    localized_visual = [
        item
        for item in visual_payloads
        if _is_localized_visual_payload(item)
    ]

    enrichment_context: dict[str, Any] = {
        "engine": "v2",
        "verdict": response.verdict,
        "fraud_types": response.fraud_types,
        "fraud_score": response.fraud_score,
        "risk_level": response.risk_level,
        "risk_score": response.fraud_score,
        "document_type": response.document_type,
        "layer_details": response.layer_details,
        "signals": [signal.model_dump(exclude_none=True) for signal in response.signals[:16]],
        "has_localized_visual_evidence": bool(localized_visual),
        "localized_visual_count": len(localized_visual),
        "localized_visual_findings": [
            {
                k: item.get(k)
                for k in ("description", "label", "type", "page", "bbox", "severity", "confidence")
                if item.get(k) not in (None, "", [], {})
            }
            for item in localized_visual[:12]
        ],
        "vendor_identity": {
            "holder_name": response.holder_name,
            "issuer_name": response.issuer_name,
            "issue_date": response.issue_date,
        },
        "holder_name": response.holder_name,
        "issuer_name": response.issuer_name,
        "issue_date": response.issue_date,
        "vendor_flags": collect_vendor_flags_v2(response.model_dump()),
    }

    # Vendor is done; PDF structure usually finished during the vendor wait.
    pdf_structure_analysis = await pdf_structure_task

    metadata_summary: str | None = None
    if pdf_structure_analysis is not None:
        vendor_pdf_metadata = find_vendor_pdf_metadata(
            response.raw_result,
            response.engine_results,
            response.layer_details,
            response.structural_profile,
            response.pdf_fraud_subscores,
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

    # Keep vendor executive narrative for the local summary path.
    if response.executive_summary:
        enrichment_context["executive_summary"] = response.executive_summary

    report_bits = build_report_enrichment(
        vendor_flags=enrichment_context.get("vendor_flags") or [],
        pdf_structure_analysis=pdf_structure_analysis,
        filename=filename,
        content=raw_content,
        vendor_recommendation=response.recommendation,
        vendor_recommendations=None,
    )
    enrichment_context.update(
        {
            "metadata_flags": report_bits["metadata_flags"],
            "certificate_flags": report_bits["certificate_flags"],
            "file_information": report_bits["file_information"],
        }
    )

    # Resolve AI probability first (may call Azure), then one Azure call for scores + narratives.
    (ai_probability, ai_probability_source) = await ai_probability_service.enrich(
        document_content=raw_content,
        filename=filename,
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
            "executive_summary": response.executive_summary,
        },
        allow_azure_estimate=True,
    )
    if ai_probability is not None:
        enrichment_context["ai_probability"] = ai_probability

    display = await ai_summary_service.enrich_display_analysis(
        context=enrichment_context,
        signals=signal_payloads,
        field_evidence=[
            item.model_dump(exclude_none=True) for item in response.field_evidence
        ],
        visual_evidence=visual_payloads,
        use_llm=True,
    )

    updates: dict = {}
    updates.update(display.as_response_updates())
    if display.executive_summary:
        updates["executive_summary"] = display.executive_summary

    if ai_probability is not None:
        updates["ai_probability"] = ai_probability
        updates["ai_probability_source"] = ai_probability_source

    if pdf_structure_analysis is not None:
        pdf_updates = PdfStructureEnrichmentService.as_v2_updates(pdf_structure_analysis)
        # Prefer Azure File Structure narrative when present.
        if "pdf_structure_summary" not in updates:
            updates["pdf_structure_summary"] = (
                metadata_summary or pdf_updates["pdf_structure_summary"]
            )
        updates["pdf_structure_findings"] = pdf_updates["pdf_structure_findings"]

        pdf_signals = [
            PaperworkSignal.model_validate(item)
            for item in pdf_updates["pdf_structure_signals"]
        ]
        if pdf_signals:
            updates["signals"] = [*response.signals, *pdf_signals]

        profile = dict(response.structural_profile or {})
        profile.update(pdf_updates["pdf_structure_profile"])
        updates["structural_profile"] = profile

        # Best-effort identity fill from Azure DI OCR when vendor OCR missed fields.
        ocr = pdf_structure_analysis.ocr_fields
        if ocr is not None:
            if not response.holder_name and ocr.holder_name:
                updates["holder_name"] = ocr.holder_name
            if not response.issuer_name and ocr.issuer:
                updates["issuer_name"] = ocr.issuer
            if not response.issue_date and (ocr.issue_date or ocr.award_date):
                updates["issue_date"] = ocr.issue_date or ocr.award_date

    updates.update(report_bits)

    return response.model_copy(update=updates)
