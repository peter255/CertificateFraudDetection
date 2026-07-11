from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.infrastructure.vendors.paperwork.client import PaperworkClient
from app.infrastructure.vendors.paperwork.dependencies import provide_paperwork_client
from app.infrastructure.vendors.paperwork.models import PaperworkVerifyResponse

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
) -> PaperworkVerifyResponse:
    raw_content = await file.read()
    return await client.verify(
        raw_content,
        filename=file.filename or "certificate.bin",
        document_type=document_type or "auto",
        ocr_mode=ocr_mode or "auto",
    )
