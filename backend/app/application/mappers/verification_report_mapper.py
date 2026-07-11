from __future__ import annotations

from app.application.dto.verify_certificate_response import (
    FindingDTO,
    ReportDTO,
    SignalDTO,
    VendorFindingDTO,
    VerifyCertificateResponse,
)
from app.domain.entities.verification_report import VendorFinding, VerificationReport
from app.domain.enums.verification_status import VerificationStatus


class VerificationReportMapper:
    """
    Converts a VerificationReport domain aggregate into the VerifyCertificateResponse DTO.

    Certificate-level fields (document_type, holder_name, issuer_name) are not
    carried on VerificationReport; callers that need those fields should build
    the response directly in the use case where the Certificate is in scope.

    The reverse direction (DTO → domain) is intentionally omitted:
    reports are always constructed by the use case, never reconstructed from a DTO.
    """

    def to_dto(self, domain: VerificationReport) -> VerifyCertificateResponse:
        primary = domain.vendor_findings[0] if domain.vendor_findings else None
        confidence = primary.confidence_score if primary else 0.0

        risk_level, risk_score, recommendation = _derive_risk(domain.overall_status, confidence)
        signals = _build_signals(primary) if primary else []
        findings = _build_findings(primary) if primary else []
        summary = domain.ai_summary or _default_summary(domain.overall_status)

        return VerifyCertificateResponse(
            certificate_id=str(domain.certificate_id),
            overall_status=str(domain.overall_status),
            confidence_score=confidence,
            document_type="",
            holder_name="",
            issuer_name="",
            vendor_findings=[
                VendorFindingDTO(
                    vendor=str(f.vendor),
                    status=str(f.status),
                    confidence_score=f.confidence_score,
                )
                for f in domain.vendor_findings
            ],
            signals=signals,
            report=ReportDTO(
                summary=summary,
                risk_level=risk_level,
                risk_score=risk_score,
                findings=findings,
                recommendation=recommendation,
            ),
            ai_summary=summary,
            verified_at=domain.verified_at,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Shared helpers — also used by the use case
# ──────────────────────────────────────────────────────────────────────────────

def derive_risk(
    status: VerificationStatus,
    confidence: float,
) -> tuple[str, int, str]:
    """Return (risk_level, risk_score, recommendation) from verdict and confidence."""
    return _derive_risk(status, confidence)


def build_signals(finding: VendorFinding) -> list[SignalDTO]:
    return _build_signals(finding)


def build_findings(finding: VendorFinding) -> list[FindingDTO]:
    return _build_findings(finding)


def build_summary(finding: VendorFinding, status: VerificationStatus) -> str:
    reasoning: str = finding.raw_response.get("reasoning") or ""
    label: str = finding.raw_response.get("verdict_label") or str(status)
    confidence_pct = round(finding.confidence_score * 100, 1)
    ml_label = finding.raw_response.get("ml_label")
    ocr_label = finding.raw_response.get("ocr_label")

    parts = [
        f"Verification Engine V1 classified this document as {label} ({confidence_pct}% confidence)."
    ]
    if ml_label:
        parts.append(f"ML model verdict: {ml_label}.")
    if ocr_label:
        parts.append(f"OCR assessment: {ocr_label}.")
    if reasoning:
        parts.append(reasoning)
    return " ".join(parts) if len(parts) > 1 else _default_summary(status)


# ──────────────────────────────────────────────────────────────────────────────
# Private helpers
# ──────────────────────────────────────────────────────────────────────────────

def _derive_risk(
    status: VerificationStatus,
    confidence: float,
) -> tuple[str, int, str]:
    if status == VerificationStatus.FRAUDULENT:
        return "high", 85, "reject"
    if status == VerificationStatus.INCONCLUSIVE:
        return "medium", 50, "manual_review"
    # AUTHENTIC
    if confidence >= 0.40:
        return "low", max(5, round(confidence * 25)), "approve"
    return "medium", 40, "manual_review"


def _build_signals(finding: VendorFinding) -> list[SignalDTO]:
    raw = finding.raw_response
    status = finding.status
    signals: list[SignalDTO] = []

    def add(category: str, description: str, signal_status: str) -> None:
        if not description:
            return
        signals.append(
            SignalDTO(
                id=str(len(signals) + 1),
                category=category,
                description=description,
                status=signal_status,
            )
        )

    verdict_status = "pass" if status == VerificationStatus.AUTHENTIC else (
        "fail" if status == VerificationStatus.FRAUDULENT else "warning"
    )

    ml_label = raw.get("ml_label")
    ml_score = raw.get("ml_score")
    if ml_label:
        score_txt = f" ({round(float(ml_score), 1)}% model confidence)" if ml_score is not None else ""
        add("ML Model", f"Model verdict: {ml_label}{score_txt}.", verdict_status)

    ocr_label = raw.get("ocr_label")
    ocr_score = raw.get("ocr_score")
    if ocr_label:
        ocr_status = "pass" if "did not detect ai" in str(ocr_label).lower() else "warning"
        score_txt = f" (score {ocr_score})" if ocr_score is not None else ""
        add("OCR Analysis", f"{ocr_label}{score_txt}.", ocr_status)

    for note in (raw.get("metadata_notes") or [])[:4]:
        note_l = str(note).lower()
        meta_status = "warning" if "no information" in note_l or "could not" in note_l else "pass"
        add("Metadata Integrity", str(note), meta_status)

    indicator_status = "pass" if status == VerificationStatus.AUTHENTIC else "fail"
    for indicator in (raw.get("key_indicators") or [])[:5]:
        add("AI Indicator", indicator, indicator_status)

    pattern_status = "warning" if status == VerificationStatus.AUTHENTIC else "fail"
    for pattern in (raw.get("visual_patterns") or [])[:4]:
        add("Visual Pattern", pattern, pattern_status)

    step = raw.get("detection_step")
    if step is not None:
        add(
            "Detection Pipeline",
            f"Completed detection step {step} of the forensic pipeline.",
            "pass" if status == VerificationStatus.AUTHENTIC else "warning",
        )

    is_valid = raw.get("is_valid")
    if is_valid is True:
        add("Document Validity", "Vendor marked the uploaded document as valid for analysis.", "pass")
    elif is_valid is False:
        add("Document Validity", "Vendor flagged the uploaded document as invalid.", "fail")

    if not signals:
        add(
            "Metadata Integrity",
            raw.get("reasoning") or "Document metadata could not be extracted.",
            "warning",
        )

    return signals


def _build_findings(finding: VendorFinding) -> list[FindingDTO]:
    raw = finding.raw_response
    findings: list[FindingDTO] = []

    label = raw.get("verdict_label") or ""
    ml_label = raw.get("ml_label")
    ml_score = raw.get("ml_score")
    if label or ml_label:
        detail = f"Final verdict: {label or ml_label}."
        if ml_score is not None:
            detail += f" Model confidence: {round(float(ml_score), 1)}%."
        agreement = raw.get("analysis_agreement") or ""
        if agreement:
            detail += f" Inter-model agreement: {agreement}."
        findings.append(FindingDTO(title="Model Consensus", detail=detail))

    reasoning = raw.get("reasoning") or ""
    if reasoning:
        findings.append(FindingDTO(title="AI Analysis", detail=reasoning))

    ocr_label = raw.get("ocr_label")
    if ocr_label:
        ocr_score = raw.get("ocr_score")
        detail = str(ocr_label)
        if ocr_score is not None:
            detail += f" (OCR score: {ocr_score})."
        findings.append(FindingDTO(title="OCR Assessment", detail=detail))

    notes = raw.get("metadata_notes") or []
    if notes:
        findings.append(
            FindingDTO(
                title="Metadata Extraction",
                detail=" | ".join(str(n) for n in notes[:4]),
            )
        )

    indicators = raw.get("key_indicators") or []
    if indicators:
        findings.append(
            FindingDTO(
                title="Key Indicators",
                detail=" ".join(f"• {i}" for i in indicators[:6]),
            )
        )

    patterns = raw.get("visual_patterns") or []
    if patterns:
        findings.append(
            FindingDTO(
                title="Visual Patterns",
                detail=" ".join(f"• {p}" for p in patterns[:5]),
            )
        )

    recs: list[str] = raw.get("vendor_recommendations") or []
    if recs:
        findings.append(
            FindingDTO(
                title="Verification Recommendations",
                detail=" ".join(recs),
            )
        )

    step = raw.get("detection_step")
    job_id = raw.get("job_id")
    pipeline_bits = []
    if step is not None:
        pipeline_bits.append(f"Detection step: {step}.")
    if job_id:
        pipeline_bits.append(f"Vendor job ID: {job_id}.")
    analysis_status = raw.get("analysis_status")
    if analysis_status:
        pipeline_bits.append(f"Deep analysis status: {analysis_status}.")
    if pipeline_bits:
        findings.append(FindingDTO(title="Pipeline Trace", detail=" ".join(pipeline_bits)))

    return findings


def _default_summary(status: VerificationStatus) -> str:
    return {
        VerificationStatus.AUTHENTIC: "The document presents indicators consistent with authenticity.",
        VerificationStatus.FRAUDULENT: "The document shows signs of digital manipulation or AI generation.",
        VerificationStatus.INCONCLUSIVE: "The analysis was inconclusive. Manual review is recommended.",
        VerificationStatus.PENDING: "Analysis is pending.",
    }[status]
