from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from app.infrastructure.vendors.paperwork.models import (
    PaperworkFraud,
    PaperworkSignal,
    PaperworkVerifyResponse,
    PaperworkVisualEvidence,
)

_BINARY_KEYS = frozenset(
    {
        "image_base64",
        "crop_image_base64",
        "thumbnail_base64",
        "preview_base64",
        "image_bytes",
        "crop_bytes",
    }
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

_KNOWN_VISUAL_FIELDS = {
    "title",
    "type",
    "field",
    "field_label",
    "layer",
    "location",
    "severity",
    "confidence",
    "description",
    "page",
    "bbox",
    "image_width",
    "image_height",
    "bbox_source",
    "image_base64",
    "crop_image_base64",
}

_STUDENT_NAME_RE = re.compile(
    r"(?:student\s+name|holder(?:\s+name)?)\s*(?:is\s+)?['\"]([A-Za-z][A-Za-z .-]{1,60}?)['\"]",
    re.IGNORECASE,
)
_QUOTED_NAME_RE = re.compile(
    r"['\"]([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})['\"]",
)
_DATE_LINE_RE = re.compile(
    r"(?:^|\n)\s*Date\s+([A-Za-z]+\s+\d{1,2}\s*,\s*\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
    re.IGNORECASE,
)


class PaperworkResponseMapper:
    """Maps a completed Engine V2 status payload into PaperworkVerifyResponse."""

    def map(self, status_payload: dict[str, Any], *, duration_ms: int) -> PaperworkVerifyResponse:
        result = status_payload.get("result") or {}
        if not isinstance(result, dict):
            result = {}

        # Map visual evidence from the original payload so has_image flags stay accurate,
        # then strip heavy binary payloads from everything we persist/return.
        visual_evidence = [
            _map_visual(item) for item in _as_dict_list(result.get("visual_evidence"))
        ]

        sanitized = _strip_binary(result)
        if not isinstance(sanitized, dict):
            sanitized = {}

        fraud_raw = sanitized.get("fraud") if isinstance(sanitized.get("fraud"), dict) else {}
        fraud = PaperworkFraud(
            color=fraud_raw.get("color"),
            score=_as_float(fraud_raw.get("score")),
            score_100=_as_float(fraud_raw.get("score_100")),
            types=_as_str_list(fraud_raw.get("types")),
            verdict=fraud_raw.get("verdict"),
            recommendation=fraud_raw.get("recommendation"),
        )

        verdict = (
            sanitized.get("verdict")
            or fraud.verdict
            or "SUSPICIOUS"
        )
        recommendation = (
            sanitized.get("recommendation")
            or fraud.recommendation
        )

        layer_details = (
            sanitized.get("layer_details")
            if isinstance(sanitized.get("layer_details"), dict)
            else {}
        )
        llm_report = (
            layer_details.get("llm_report")
            if isinstance(layer_details.get("llm_report"), dict)
            else {}
        )
        executive_summary = (
            _as_optional_str(sanitized.get("executive_summary"))
            or _as_optional_str(llm_report.get("executive_summary"))
        )

        signals = [_map_signal(item) for item in _as_dict_list(sanitized.get("signals"))]
        field_evidence = [
            _map_signal(item) for item in _as_dict_list(sanitized.get("field_evidence"))
        ]

        holder_name, issuer_name, issue_date = _extract_identity(
            sanitized,
            signals=signals,
            field_evidence=field_evidence,
            layer_details=layer_details,
        )

        return PaperworkVerifyResponse(
            job_id=str(status_payload.get("job_id") or ""),
            status=str(status_payload.get("status") or "completed"),
            progress=_as_int(status_payload.get("progress")),
            progress_message=status_payload.get("progress_message"),
            created_at=_as_optional_str(status_payload.get("created_at")),
            updated_at=_as_optional_str(status_payload.get("updated_at")),
            completed_at=_as_optional_str(status_payload.get("completed_at")),
            verdict=str(verdict),
            fraud_color=sanitized.get("fraud_color") or fraud.color,
            fraud_score=_as_float(
                sanitized.get("fraud_score")
                if sanitized.get("fraud_score") is not None
                else fraud.score_100
            ),
            risk_level=sanitized.get("risk_level"),
            fraud_types=_as_str_list(sanitized.get("fraud_types") or fraud.types),
            recommendation=recommendation,
            executive_summary=executive_summary,
            is_scan=sanitized.get("is_scan") if isinstance(sanitized.get("is_scan"), bool) else None,
            file_kind=sanitized.get("file_kind"),
            document_type=sanitized.get("document_type"),
            processing_time=_as_float(sanitized.get("processing_time")),
            holder_name=holder_name,
            issuer_name=issuer_name,
            issue_date=issue_date,
            fraud=fraud,
            signals=signals,
            field_evidence=field_evidence,
            visual_evidence=visual_evidence,
            analysis_flow=_as_dict_list(sanitized.get("analysis_flow")),
            layers_applied=_as_str_list(sanitized.get("layers_applied")),
            engine_scores=(
                sanitized.get("engine_scores")
                if isinstance(sanitized.get("engine_scores"), dict)
                else {}
            ),
            evidence_groups=_sanitize_evidence_groups(sanitized.get("evidence_groups")),
            layer_details=layer_details,
            classification=(
                sanitized.get("classification")
                if isinstance(sanitized.get("classification"), dict)
                else {}
            ),
            engine_results=(
                sanitized.get("engine_results")
                if isinstance(sanitized.get("engine_results"), dict)
                else {}
            ),
            structural_profile=(
                sanitized.get("structural_profile")
                if isinstance(sanitized.get("structural_profile"), dict)
                else {}
            ),
            pdf_fraud_subscores=(
                sanitized.get("pdf_fraud_subscores")
                if isinstance(sanitized.get("pdf_fraud_subscores"), dict)
                else {}
            ),
            raw_result=sanitized,
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
        field=_normalize_field(raw.get("field")),
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
        extras=_strip_binary(extras) if isinstance(extras, dict) else {},
    )


def _map_visual(raw: dict[str, Any]) -> PaperworkVisualEvidence:
    extras = {
        k: v
        for k, v in raw.items()
        if k not in _KNOWN_VISUAL_FIELDS and k not in _BINARY_KEYS
    }
    return PaperworkVisualEvidence(
        title=raw.get("title"),
        type=raw.get("type"),
        field=_normalize_field(raw.get("field")),
        field_label=raw.get("field_label"),
        layer=raw.get("layer"),
        location=raw.get("location"),
        severity=raw.get("severity"),
        confidence=_as_float(raw.get("confidence")),
        description=raw.get("description"),
        page=_as_int(raw.get("page")),
        bbox=_as_int_list(raw.get("bbox")),
        image_width=_as_int(raw.get("image_width")),
        image_height=_as_int(raw.get("image_height")),
        bbox_source=raw.get("bbox_source"),
        has_image=bool(raw.get("image_base64")),
        has_crop_image=bool(raw.get("crop_image_base64")),
        extras=_strip_binary(extras) if isinstance(extras, dict) else {},
    )


def _extract_identity(
    result: dict[str, Any],
    *,
    signals: list[PaperworkSignal],
    field_evidence: list[PaperworkSignal],
    layer_details: dict[str, Any],
) -> tuple[str | None, str | None, str | None]:
    holder: str | None = None
    issuer: str | None = None
    issue_date: str | None = None

    llm_visual = (
        layer_details.get("llm_visual")
        if isinstance(layer_details.get("llm_visual"), dict)
        else {}
    )

    # Brand / issuer from template comparisons is usually the cleanest signal.
    for finding in _as_dict_list(llm_visual.get("findings")):
        brand = _brand_from_template_text(str(finding.get("detail") or ""))
        if brand:
            issuer = brand
            break
    if not issuer:
        for signal in signals:
            brand = _brand_from_template_text(signal.description or "")
            if brand:
                issuer = brand
                break

    for finding in _as_dict_list(llm_visual.get("findings")):
        field = _normalize_field(finding.get("field"))
        detail = str(finding.get("detail") or finding.get("description") or "")
        if field in {"student_name", "holder_name", "recipient_name"} and not holder:
            holder = _name_from_text(detail) or holder

    for signal in [*field_evidence, *signals]:
        field = (signal.field or "").lower()
        desc = signal.description or ""
        if field in {"student_name", "holder_name", "recipient_name"} and not holder:
            holder = _name_from_text(desc) or holder

    ocr_text = _collect_ocr_text(layer_details)
    if ocr_text:
        if not holder:
            holder = _holder_from_ocr(ocr_text)
        if not issue_date:
            match = _DATE_LINE_RE.search(ocr_text)
            if match:
                issue_date = match.group(1).strip()
        if not issuer:
            issuer = _issuer_from_ocr(ocr_text, document_type=str(result.get("document_type") or ""))

    detected_bank = llm_visual.get("detected_bank")
    if not issuer and isinstance(detected_bank, str) and detected_bank.strip():
        issuer = detected_bank.strip()

    return (
        _clean_name(holder),
        _clean_name(issuer),
        re.sub(r"\s+,", ",", issue_date).strip() if issue_date else None,
    )


def _collect_ocr_text(layer_details: dict[str, Any]) -> str:
    chunks: list[str] = []
    overlay = layer_details.get("overlay_detector")
    if isinstance(overlay, dict):
        meta = overlay.get("metadata") if isinstance(overlay.get("metadata"), dict) else {}
        text = meta.get("ocr_geometry_visible_text")
        if isinstance(text, str) and text.strip():
            chunks.append(text)

    prep = layer_details.get("document_preparation")
    if isinstance(prep, dict):
        ocr = prep.get("ocr") if isinstance(prep.get("ocr"), dict) else {}
        for key in ("visible_text", "text", "full_text"):
            value = ocr.get(key)
            if isinstance(value, str) and value.strip():
                chunks.append(value)

    return "\n".join(chunks)


def _holder_from_ocr(ocr_text: str) -> str | None:
    match = _STUDENT_NAME_RE.search(ocr_text)
    if match:
        candidate = match.group(1).strip()
        if _looks_like_person_name(candidate):
            return candidate

    lines = [ln.strip() for ln in ocr_text.splitlines() if ln.strip()]
    # Prefer the line immediately before a Date line — common certificate layout.
    for i, line in enumerate(lines):
        if re.match(r"^Date\b", line, re.IGNORECASE) and i > 0:
            candidate = lines[i - 1]
            if _looks_like_person_name(candidate) and not candidate.lower().startswith("instructors"):
                return candidate

    skip_prefixes = (
        "certificate",
        "instructors",
        "date",
        "length",
        "reference",
        "devops",
        "integration",
        "beginners",
    )
    for i, line in enumerate(lines):
        if "certificate of" in line.lower():
            for candidate in lines[i + 1 : i + 10]:
                cl = candidate.lower()
                if any(cl.startswith(s) for s in skip_prefixes):
                    continue
                if _looks_like_person_name(candidate):
                    return candidate
    return None


def _issuer_from_ocr(ocr_text: str, *, document_type: str) -> str | None:
    lines = [ln.strip() for ln in ocr_text.splitlines() if ln.strip()]
    if not lines:
        return None

    # First non-empty line is often the brand / issuer on certificates.
    first = re.sub(r"[^\w\s&.'-]", "", lines[0]).strip()
    if (
        first
        and len(first) >= 4
        and not first.lower().startswith("certificate")
        and not (_looks_like_person_name(first) and document_type == "academic_certificate")
    ):
        return first

    # Prefer recognizable multi-part domains over short vanity hosts like ude.my.
    url_match = re.search(
        r"(?:https?://)?(?:www\.)?([a-z0-9-]+)\.(com|org|net|edu|io)\b",
        ocr_text,
        re.I,
    )
    if url_match:
        host = url_match.group(1).replace("-", " ").strip()
        if len(host) >= 4 and host.lower() not in {"www", "http", "https"}:
            return host.title()
    return None


def _brand_from_template_text(text: str) -> str | None:
    match = re.search(
        r"standard\s+([A-Z][A-Za-z0-9&. '-]{1,40}?)\s+certificate\s+template",
        text,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    match = re.search(
        r"genuine\s+([A-Z][A-Za-z0-9&. '-]{1,40}?)\s+certificates?",
        text,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    return None


def _name_from_text(text: str) -> str | None:
    match = _STUDENT_NAME_RE.search(text)
    if match:
        candidate = match.group(1).strip()
        if _looks_like_person_name(candidate):
            return candidate
    match = _QUOTED_NAME_RE.search(text)
    if match:
        candidate = match.group(1).strip()
        if _looks_like_person_name(candidate):
            return candidate
    return None


def _looks_like_person_name(value: str) -> bool:
    parts = [p for p in re.split(r"\s+", value.strip()) if p]
    if not (1 <= len(parts) <= 4):
        return False
    if any(len(p) < 2 or not p[0].isalpha() for p in parts):
        return False
    if any(ch.isdigit() for ch in value):
        return False
    return all(p[0].isupper() or p.islower() for p in parts)


def _clean_name(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip(" .,:;-")
    return cleaned or None


def _normalize_field(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"null", "none", "n/a"}:
        return None
    return text


def _sanitize_evidence_groups(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    out: dict[str, Any] = {}
    for key, group in value.items():
        if isinstance(group, list):
            cleaned: list[Any] = []
            for item in group:
                if isinstance(item, dict):
                    cleaned.append(_strip_binary(item))
                else:
                    cleaned.append(item)
            out[str(key)] = cleaned
        elif isinstance(group, dict):
            out[str(key)] = _strip_binary(group)
        else:
            out[str(key)] = group
    return out


def _strip_binary(value: Any) -> Any:
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for key, item in value.items():
            if key in _BINARY_KEYS:
                out[f"has_{key.replace('_base64', '').replace('_bytes', '')}"] = bool(item)
                continue
            if isinstance(item, str) and len(item) > 8000 and _looks_like_base64(item):
                out[f"has_{key}"] = True
                continue
            out[key] = _strip_binary(item)
        return out
    if isinstance(value, list):
        return [_strip_binary(item) for item in value]
    return value


def _looks_like_base64(value: str) -> bool:
    sample = value[:120].replace("\n", "").replace("\r", "")
    if sample.startswith("data:image"):
        return True
    return bool(re.fullmatch(r"[A-Za-z0-9+/=]+", sample)) and len(value) > 8000


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
    text = str(value).strip()
    return text or None
