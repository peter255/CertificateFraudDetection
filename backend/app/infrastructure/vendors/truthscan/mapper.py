from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.infrastructure.vendors.truthscan.models import (
    TruthScanAnalysisDetails,
    TruthScanFinding,
    TruthScanReport,
    TruthScanSignal,
    TruthScanVerifyResponse,
)

_FINAL_RESULT_TO_STATUS: dict[str, str] = {
    "real": "authentic",
    "ai generated": "fraudulent",
    "digitally edited": "fraudulent",
}

_DOCUMENT_TYPE_LABELS: dict[str, str] = {
    "academic_certificate": "Academic Certificate",
    "professional_license": "Professional License",
    "identity_document": "Identity Document",
    "corporate_document": "Corporate Document",
}


class TruthScanResponseMapper:
    """
    Converts the raw Engine V1 /query JSON into a TruthScanVerifyResponse.

    Engine-specific field names and presentation logic live here.
    """

    def map(
        self,
        raw: dict,
        *,
        document_type: str,
        holder_name: str,
        issuer_name: str,
        duration_ms: int,
        certificate_id: str | None = None,
    ) -> TruthScanVerifyResponse:
        details: dict = raw.get("result_details") or {}
        analysis: dict = details.get("analysis_results") or {}
        if not isinstance(analysis, dict):
            analysis = {}

        final_result_raw: str = (details.get("final_result") or "").strip()
        overall_status = _FINAL_RESULT_TO_STATUS.get(
            final_result_raw.lower(), "inconclusive"
        )

        # Engine V1 `result` is the ML model's confidence in its final_result (0–100 scale).
        raw_score: float = float(raw.get("result") or details.get("confidence") or 0.0)
        confidence_score = round(min(max(raw_score / 100.0, 0.0), 1.0), 4)

        metadata_items = _as_str_list(details.get("metadata"))
        ocr_label, ocr_score = _pair(details.get("ocr"))
        ml_label, ml_score = _pair(details.get("ml_model"))

        reasoning = (
            analysis.get("detailedReasoning")
            or analysis.get("summary")
            or _first(metadata_items)
            or ""
        )

        job_id = str(raw.get("id") or "")
        analysis_details = TruthScanAnalysisDetails(
            verdict_label=final_result_raw or "Unknown",
            raw_score=raw_score,
            reasoning=reasoning,
            key_indicators=_as_str_list(analysis.get("keyIndicators")),
            visual_patterns=_as_str_list(analysis.get("visualPatterns")),
            vendor_recommendations=_as_str_list(analysis.get("recommendations")),
            heatmap_url=details.get("heatmap_url"),
            analysis_agreement=analysis.get("agreement") or "",
            detection_step=details.get("detection_step"),
            is_valid=details.get("is_valid"),
            metadata_notes=metadata_items,
            ocr_label=ocr_label,
            ocr_score=ocr_score,
            ml_label=ml_label,
            ml_score=ml_score,
            analysis_status=details.get("analysis_results_status") or "",
            job_id=job_id,
            raw_query_response=raw,
        )

        signals = _build_signals(overall_status, analysis_details)
        findings = _build_findings(analysis_details)
        summary = _build_summary(overall_status, analysis_details, confidence_score)
        risk_level, risk_score, recommendation = _derive_risk(overall_status, confidence_score)

        doc_type_label = _DOCUMENT_TYPE_LABELS.get(
            document_type.lower().strip(),
            document_type.replace("_", " ").title() if document_type else "Unknown",
        )

        return TruthScanVerifyResponse(
            certificate_id=certificate_id or str(uuid4()),
            job_id=job_id,
            overall_status=overall_status,
            confidence_score=confidence_score,
            final_result=final_result_raw or "Unknown",
            raw_score=raw_score,
            document_type=doc_type_label,
            holder_name=holder_name,
            issuer_name=issuer_name,
            analysis=analysis_details,
            signals=signals,
            report=TruthScanReport(
                summary=summary,
                risk_level=risk_level,
                risk_score=risk_score,
                findings=findings,
                recommendation=recommendation,
            ),
            ai_summary=summary,
            verified_at=datetime.utcnow(),
            duration_ms=duration_ms,
        )


def _first(items: list) -> str | None:
    return items[0] if items else None


def _as_str_list(value: object) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, list):
        out: list[str] = []
        for item in value:
            if isinstance(item, str) and item.strip():
                out.append(item.strip())
            elif item is not None and not isinstance(item, (list, dict)):
                out.append(str(item))
        return out
    return []


def _pair(value: object) -> tuple[str | None, float | None]:
    if not isinstance(value, list) or not value:
        return None, None
    label = str(value[0]) if value[0] is not None else None
    score: float | None = None
    if len(value) > 1 and value[1] is not None:
        try:
            score = float(value[1])
        except (TypeError, ValueError):
            score = None
    return label, score


def _derive_risk(status: str, confidence: float) -> tuple[str, int, str]:
    if status == "fraudulent":
        return "high", 85, "reject"
    if status == "inconclusive":
        return "medium", 50, "manual_review"
    if confidence >= 0.40:
        return "low", max(5, round(confidence * 25)), "approve"
    return "medium", 40, "manual_review"


def _build_summary(
    status: str,
    analysis: TruthScanAnalysisDetails,
    confidence_score: float,
) -> str:
    confidence_pct = round(confidence_score * 100, 1)
    parts = [
        f"Verification Engine V1 classified this document as {analysis.verdict_label} "
        f"({confidence_pct}% confidence)."
    ]
    if analysis.ml_label:
        parts.append(f"ML model verdict: {analysis.ml_label}.")
    if analysis.ocr_label:
        parts.append(f"OCR assessment: {analysis.ocr_label}.")
    if analysis.reasoning:
        parts.append(analysis.reasoning)
    if len(parts) > 1:
        return " ".join(parts)
    return {
        "authentic": "The document presents indicators consistent with authenticity.",
        "fraudulent": "The document shows signs of digital manipulation or AI generation.",
        "inconclusive": "The analysis was inconclusive. Manual review is recommended.",
    }.get(status, "Analysis complete.")


def _build_signals(status: str, analysis: TruthScanAnalysisDetails) -> list[TruthScanSignal]:
    signals: list[TruthScanSignal] = []

    def add(category: str, description: str, signal_status: str) -> None:
        if not description:
            return
        signals.append(
            TruthScanSignal(
                id=str(len(signals) + 1),
                category=category,
                description=description,
                status=signal_status,
            )
        )

    verdict_status = (
        "pass" if status == "authentic" else ("fail" if status == "fraudulent" else "warning")
    )

    if analysis.ml_label:
        score_txt = (
            f" ({round(float(analysis.ml_score), 1)}% model confidence)"
            if analysis.ml_score is not None
            else ""
        )
        add("ML Model", f"Model verdict: {analysis.ml_label}{score_txt}.", verdict_status)

    if analysis.ocr_label:
        ocr_status = (
            "pass" if "did not detect ai" in str(analysis.ocr_label).lower() else "warning"
        )
        score_txt = f" (score {analysis.ocr_score})" if analysis.ocr_score is not None else ""
        add("OCR Analysis", f"{analysis.ocr_label}{score_txt}.", ocr_status)

    for note in analysis.metadata_notes[:4]:
        note_l = str(note).lower()
        meta_status = "warning" if "no information" in note_l or "could not" in note_l else "pass"
        add("Metadata Integrity", str(note), meta_status)

    indicator_status = "pass" if status == "authentic" else "fail"
    for indicator in analysis.key_indicators[:5]:
        add("AI Indicator", indicator, indicator_status)

    pattern_status = "warning" if status == "authentic" else "fail"
    for pattern in analysis.visual_patterns[:4]:
        add("Visual Pattern", pattern, pattern_status)

    if analysis.detection_step is not None:
        add(
            "Detection Pipeline",
            f"Completed detection step {analysis.detection_step} of the forensic pipeline.",
            "pass" if status == "authentic" else "warning",
        )

    if analysis.is_valid is True:
        add("Document Validity", "Vendor marked the uploaded document as valid for analysis.", "pass")
    elif analysis.is_valid is False:
        add("Document Validity", "Vendor flagged the uploaded document as invalid.", "fail")

    if not signals:
        add(
            "Metadata Integrity",
            analysis.reasoning or "Document metadata could not be extracted.",
            "warning",
        )

    return signals


def _build_findings(analysis: TruthScanAnalysisDetails) -> list[TruthScanFinding]:
    findings: list[TruthScanFinding] = []

    label = analysis.verdict_label or ""
    if label or analysis.ml_label:
        detail = f"Final verdict: {label or analysis.ml_label}."
        if analysis.ml_score is not None:
            detail += f" Model confidence: {round(float(analysis.ml_score), 1)}%."
        if analysis.analysis_agreement:
            detail += f" Inter-model agreement: {analysis.analysis_agreement}."
        findings.append(TruthScanFinding(title="Model Consensus", detail=detail))

    if analysis.reasoning:
        findings.append(TruthScanFinding(title="AI Analysis", detail=analysis.reasoning))

    if analysis.ocr_label:
        detail = str(analysis.ocr_label)
        if analysis.ocr_score is not None:
            detail += f" (OCR score: {analysis.ocr_score})."
        findings.append(TruthScanFinding(title="OCR Assessment", detail=detail))

    if analysis.metadata_notes:
        findings.append(
            TruthScanFinding(
                title="Metadata Extraction",
                detail=" | ".join(str(n) for n in analysis.metadata_notes[:4]),
            )
        )

    if analysis.key_indicators:
        findings.append(
            TruthScanFinding(
                title="Key Indicators",
                detail=" ".join(f"• {i}" for i in analysis.key_indicators[:6]),
            )
        )

    if analysis.visual_patterns:
        findings.append(
            TruthScanFinding(
                title="Visual Patterns",
                detail=" ".join(f"• {p}" for p in analysis.visual_patterns[:5]),
            )
        )

    if analysis.vendor_recommendations:
        findings.append(
            TruthScanFinding(
                title="Verification Recommendations",
                detail=" ".join(analysis.vendor_recommendations),
            )
        )

    pipeline_bits: list[str] = []
    if analysis.detection_step is not None:
        pipeline_bits.append(f"Detection step: {analysis.detection_step}.")
    if analysis.job_id:
        pipeline_bits.append(f"Vendor job ID: {analysis.job_id}.")
    if analysis.analysis_status:
        pipeline_bits.append(f"Deep analysis status: {analysis.analysis_status}.")
    if pipeline_bits:
        findings.append(TruthScanFinding(title="Pipeline Trace", detail=" ".join(pipeline_bits)))

    return findings
