from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.application.dto.verify_certificate_request import VerifyCertificateRequest
from app.application.dto.verify_certificate_response import VerifyCertificateResponse
from app.application.use_cases.verify_certificate import VerifyCertificateUseCase
from app.presentation.dependencies.container import provide_verify_certificate_use_case

router = APIRouter(prefix="/api/v1", tags=["certificates"])


@router.post(
    "/certificates/verify",
    response_model=VerifyCertificateResponse,
    summary="Verify a certificate document",
    description=(
        "Upload a certificate file for AI-powered authenticity verification. "
        "The document is analysed by TruthScan and the result is returned as a "
        "structured verdict with signals and an executive report."
    ),
)
async def verify_certificate(
    file: UploadFile = File(..., description="Certificate file (PDF, PNG, or JPEG)."),
    holder_name: str = Form(default="Unknown", description="Full name of the certificate holder."),
    issuer_name: str = Form(default="Unknown", description="Name of the issuing authority."),
    document_type: str = Form(
        default="academic_certificate",
        description="Document category: academic_certificate | professional_license | identity_document | corporate_document",
    ),
    use_case: VerifyCertificateUseCase = Depends(provide_verify_certificate_use_case),
) -> VerifyCertificateResponse:
    raw_content = await file.read()

    request = VerifyCertificateRequest(
        document_content=raw_content,
        document_type=document_type,
        holder_name=holder_name or file.filename or "Unknown",
        issuer_name=issuer_name or "Unknown",
    )

    return await use_case.execute(request)
