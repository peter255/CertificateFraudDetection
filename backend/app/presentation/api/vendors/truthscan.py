from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.infrastructure.vendors.truthscan.client import TruthScanClient
from app.infrastructure.vendors.truthscan.dependencies import provide_truthscan_client
from app.infrastructure.vendors.truthscan.models import TruthScanVerifyResponse

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
) -> TruthScanVerifyResponse:
    raw_content = await file.read()
    return await client.verify(
        raw_content,
        filename=file.filename or "certificate.bin",
        document_type=document_type,
        holder_name=holder_name or file.filename or "Unknown",
        issuer_name=issuer_name or "Unknown",
    )
