from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile

from app.application.dto.pdf_structure import PdfStructureAnalyzeResponse
from app.application.services.pdf_structure.analysis_service import PdfStructureAnalysisService
from app.presentation.dependencies.pdf_structure import provide_pdf_structure_analysis_service

router = APIRouter(prefix="/pdf-structure", tags=["pdf-structure"])


@router.post(
    "/analyze",
    response_model=PdfStructureAnalyzeResponse,
    summary="Run forensic PDF Structure Analysis",
    description=(
        "Analyzes a document using Azure Document Intelligence OCR, PDF metadata, "
        "deterministic forensic rules, and optional LLM logical-consistency checks. "
        "Returns structured findings (suspicious indicators) — not a fraud verdict."
    ),
)
async def analyze_pdf_structure(
    file: UploadFile = File(..., description="Document file (PDF, PNG, or JPEG)."),
    service: PdfStructureAnalysisService = Depends(provide_pdf_structure_analysis_service),
) -> PdfStructureAnalyzeResponse:
    content = await file.read()
    return await service.analyze(
        content,
        filename=file.filename or "document.bin",
        content_type=file.content_type,
    )
