from __future__ import annotations

from datetime import datetime

from app.application.dto.verify_certificate_request import VerifyCertificateRequest
from app.application.dto.verify_certificate_response import (
    ReportDTO,
    VendorFindingDTO,
    VerifyCertificateResponse,
)
from app.application.interfaces.vendor_verification_port import IVendorVerificationPort
from app.application.mappers.verification_report_mapper import (
    build_findings,
    build_signals,
    build_summary,
    derive_risk,
)
from app.domain.entities.certificate import Certificate
from app.domain.entities.verification_report import VendorFinding
from app.domain.enums.document_type import DocumentType
from app.domain.value_objects.certificate_id import CertificateId
from app.domain.value_objects.document_hash import DocumentHash
from app.domain.value_objects.holder_name import HolderName
from app.domain.value_objects.issuer_name import IssuerName

_DOCUMENT_TYPE_LABELS: dict[str, str] = {
    "academic_certificate": "Academic Certificate",
    "professional_license": "Professional License",
    "identity_document": "Identity Document",
    "corporate_document": "Corporate Document",
}


class VerifyCertificateUseCase:
    """
    Orchestrates a single-vendor document verification flow via TruthScan.

    Responsibilities:
      1. Construct a Certificate domain object from the incoming request.
      2. Delegate to the vendor port to obtain a VendorFinding.
      3. Assemble and return a VerifyCertificateResponse DTO.

    The application layer never imports from infrastructure; it communicates
    with TruthScan exclusively through IVendorVerificationPort.
    """

    def __init__(self, vendor: IVendorVerificationPort) -> None:
        self._vendor = vendor

    async def execute(self, request: VerifyCertificateRequest) -> VerifyCertificateResponse:
        certificate = _build_certificate(request)
        finding = await self._vendor.verify(certificate)
        return _build_response(certificate, finding)


# ──────────────────────────────────────────────────────────────────────────────
# Private helpers
# ──────────────────────────────────────────────────────────────────────────────

def _build_certificate(request: VerifyCertificateRequest) -> Certificate:
    doc_type_raw = request.document_type.lower().strip()
    try:
        document_type = DocumentType(doc_type_raw)
    except ValueError:
        document_type = DocumentType.ACADEMIC_CERTIFICATE

    return Certificate(
        id=CertificateId.generate(),
        holder_name=HolderName(value=request.holder_name),
        issuer_name=IssuerName(value=request.issuer_name),
        document_hash=DocumentHash.from_bytes(request.document_content),
        document_type=document_type,
        raw_content=request.document_content,
    )


def _build_response(
    certificate: Certificate,
    finding: VendorFinding,
) -> VerifyCertificateResponse:
    risk_level, risk_score, recommendation = derive_risk(finding.status, finding.confidence_score)
    signals = build_signals(finding)
    report_findings = build_findings(finding)
    summary = build_summary(finding, finding.status)

    doc_type_label = _DOCUMENT_TYPE_LABELS.get(
        str(certificate.document_type), str(certificate.document_type).replace("_", " ").title()
    )

    return VerifyCertificateResponse(
        certificate_id=str(certificate.id),
        overall_status=str(finding.status),
        confidence_score=finding.confidence_score,
        document_type=doc_type_label,
        holder_name=str(certificate.holder_name),
        issuer_name=str(certificate.issuer_name),
        vendor_findings=[
            VendorFindingDTO(
                vendor=str(finding.vendor),
                status=str(finding.status),
                confidence_score=finding.confidence_score,
            )
        ],
        signals=signals,
        report=ReportDTO(
            summary="",  # Narrative lives only in ai_summary
            risk_level=risk_level,
            risk_score=risk_score,
            findings=report_findings,
            recommendation=recommendation,
        ),
        ai_summary=summary,
        verified_at=datetime.utcnow(),
    )
