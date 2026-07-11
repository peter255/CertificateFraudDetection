from __future__ import annotations

from app.domain.entities.verification_report import VendorFinding
from app.domain.enums.vendor_name import VendorName
from app.domain.enums.verification_status import VerificationStatus

_FINAL_RESULT_TO_STATUS: dict[str, VerificationStatus] = {
    "real": VerificationStatus.AUTHENTIC,
    "ai generated": VerificationStatus.FRAUDULENT,
    "digitally edited": VerificationStatus.FRAUDULENT,
}


class TruthScanResponseMapper:
    """
    Converts the raw TruthScan /query JSON response into a VendorFinding domain object.

    All TruthScan-specific field names are confined to this class.
    The raw_response dict in the returned VendorFinding uses vendor-agnostic keys
    so that no TruthScan terminology propagates beyond the infrastructure layer.
    """

    def map(self, raw: dict) -> VendorFinding:
        details: dict = raw.get("result_details") or {}
        analysis: dict = details.get("analysis_results") or {}
        if not isinstance(analysis, dict):
            analysis = {}

        final_result_raw: str = (details.get("final_result") or "").strip()
        status = _FINAL_RESULT_TO_STATUS.get(
            final_result_raw.lower(), VerificationStatus.INCONCLUSIVE
        )

        # TruthScan `result` is the ML model's confidence in its final_result (0–100 scale).
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

        normalized_response: dict = {
            "verdict_label": final_result_raw or "Unknown",
            "raw_score": raw_score,
            "reasoning": reasoning,
            "key_indicators": _as_str_list(analysis.get("keyIndicators")),
            "visual_patterns": _as_str_list(analysis.get("visualPatterns")),
            "vendor_recommendations": _as_str_list(analysis.get("recommendations")),
            "heatmap_url": details.get("heatmap_url"),
            "analysis_agreement": analysis.get("agreement") or "",
            "detection_step": details.get("detection_step"),
            "is_valid": details.get("is_valid"),
            "metadata_notes": metadata_items,
            "ocr_label": ocr_label,
            "ocr_score": ocr_score,
            "ml_label": ml_label,
            "ml_score": ml_score,
            "analysis_status": details.get("analysis_results_status") or "",
            "job_id": raw.get("id") or "",
        }

        return VendorFinding(
            vendor=VendorName.TRUTHSCAN,
            status=status,
            confidence_score=confidence_score,
            raw_response=normalized_response,
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
