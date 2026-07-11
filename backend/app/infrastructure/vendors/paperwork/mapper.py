from __future__ import annotations

from datetime import datetime
from typing import Any

from app.infrastructure.vendors.paperwork.models import (
    PaperworkFraud,
    PaperworkSignal,
    PaperworkVerifyResponse,
)

_KNOWN_SIGNAL_FIELDS = {
    "type",
    "check",
    "layer",
    "stage",
    "engine",
    "detector",
    "severity",
    "confidence",
    "description",
    "engine_label",
    "detector_label",
    "evidence_class",
    "id",
    "bbox",
    "page",
    "image_width",
    "image_height",
    "bbox_area_ratio",
    "location",
    "related_bboxes",
    "bbox_source",
    "field",
    "field_label",
    "field_fit_score",
    "field_importance",
    "field_assignment_source",
    "field_assignment_confidence",
    "source",
    "fraud_type",
    "score_role",
    "generator",
    "issuer_name",
    "issuer_category",
}


class PaperworkResponseMapper:
    """Maps a completed Engine V2 status payload into PaperworkVerifyResponse."""

    def map(self, status_payload: dict[str, Any], *, duration_ms: int) -> PaperworkVerifyResponse:
        result = status_payload.get("result") or {}
        if not isinstance(result, dict):
            result = {}

        fraud_raw = result.get("fraud") if isinstance(result.get("fraud"), dict) else {}
        fraud = PaperworkFraud(
            color=fraud_raw.get("color"),
            score=_as_float(fraud_raw.get("score")),
            score_100=_as_float(fraud_raw.get("score_100")),
            types=_as_str_list(fraud_raw.get("types")),
            verdict=fraud_raw.get("verdict"),
            recommendation=fraud_raw.get("recommendation"),
        )

        verdict = (
            result.get("verdict")
            or fraud.verdict
            or "SUSPICIOUS"
        )
        recommendation = fraud.recommendation or result.get("recommendation")

        return PaperworkVerifyResponse(
            job_id=str(status_payload.get("job_id") or ""),
            status=str(status_payload.get("status") or "completed"),
            progress=_as_int(status_payload.get("progress")),
            progress_message=status_payload.get("progress_message"),
            created_at=_as_optional_str(status_payload.get("created_at")),
            updated_at=_as_optional_str(status_payload.get("updated_at")),
            completed_at=_as_optional_str(status_payload.get("completed_at")),
            verdict=str(verdict),
            fraud_color=result.get("fraud_color") or fraud.color,
            fraud_score=_as_float(result.get("fraud_score") if result.get("fraud_score") is not None else fraud.score_100),
            risk_level=result.get("risk_level"),
            fraud_types=_as_str_list(result.get("fraud_types") or fraud.types),
            recommendation=recommendation,
            is_scan=result.get("is_scan") if isinstance(result.get("is_scan"), bool) else None,
            file_kind=result.get("file_kind"),
            document_type=result.get("document_type"),
            fraud=fraud,
            signals=[_map_signal(item) for item in _as_dict_list(result.get("signals"))],
            field_evidence=[_map_signal(item) for item in _as_dict_list(result.get("field_evidence"))],
            analysis_flow=_as_dict_list(result.get("analysis_flow")),
            engine_scores=result.get("engine_scores") if isinstance(result.get("engine_scores"), dict) else {},
            layer_details=result.get("layer_details") if isinstance(result.get("layer_details"), dict) else {},
            classification=result.get("classification") if isinstance(result.get("classification"), dict) else {},
            engine_results=result.get("engine_results") if isinstance(result.get("engine_results"), dict) else {},
            raw_result=result,
            verified_at=datetime.utcnow(),
            duration_ms=duration_ms,
        )


def _map_signal(raw: dict[str, Any]) -> PaperworkSignal:
    extras = {k: v for k, v in raw.items() if k not in _KNOWN_SIGNAL_FIELDS}
    return PaperworkSignal(
        type=raw.get("type"),
        check=raw.get("check"),
        layer=raw.get("layer"),
        stage=raw.get("stage"),
        engine=raw.get("engine"),
        detector=raw.get("detector"),
        severity=raw.get("severity"),
        confidence=_as_float(raw.get("confidence")),
        description=raw.get("description"),
        engine_label=raw.get("engine_label"),
        detector_label=raw.get("detector_label"),
        evidence_class=raw.get("evidence_class"),
        id=raw.get("id"),
        bbox=_as_int_list(raw.get("bbox")),
        page=_as_int(raw.get("page")),
        image_width=_as_int(raw.get("image_width")),
        image_height=_as_int(raw.get("image_height")),
        bbox_area_ratio=_as_float(raw.get("bbox_area_ratio")),
        location=raw.get("location"),
        related_bboxes=_as_dict_list(raw.get("related_bboxes")) or None,
        bbox_source=raw.get("bbox_source"),
        field=raw.get("field"),
        field_label=raw.get("field_label"),
        field_fit_score=_as_float(raw.get("field_fit_score")),
        field_importance=_as_float(raw.get("field_importance")),
        field_assignment_source=raw.get("field_assignment_source"),
        field_assignment_confidence=_as_float(raw.get("field_assignment_confidence")),
        source=raw.get("source"),
        fraud_type=raw.get("fraud_type"),
        score_role=raw.get("score_role"),
        generator=raw.get("generator"),
        issuer_name=raw.get("issuer_name"),
        issuer_category=raw.get("issuer_category"),
        extras=extras,
    )


def _as_str_list(value: object) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, list):
        return [str(item) for item in value if item is not None]
    return []


def _as_dict_list(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _as_int_list(value: object) -> list[int] | None:
    if not isinstance(value, list):
        return None
    out: list[int] = []
    for item in value:
        try:
            out.append(int(item))
        except (TypeError, ValueError):
            return None
    return out


def _as_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_int(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_optional_str(value: object) -> str | None:
    if value is None:
        return None
    return str(value)
