from __future__ import annotations

import re
from typing import Any

from app.application.dto.pdf_structure import OcrExtractedFields

_FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "holder_name": (
        "holder name",
        "holder",
        "recipient",
        "recipient name",
        "student name",
        "candidate name",
        "awarded to",
        "presented to",
        "name",
        "full name",
    ),
    "certificate_name": (
        "certificate name",
        "certificate title",
        "course name",
        "program",
        "program name",
        "qualification",
        "title",
        "credential",
    ),
    "issuer": (
        "issuer",
        "issuing authority",
        "issued by",
        "organization",
        "organisation",
        "institution",
        "university",
        "college",
        "provider",
        "authority",
    ),
    "award_date": (
        "award date",
        "awarded on",
        "date awarded",
        "date of award",
        "completion date",
        "completed on",
    ),
    "issue_date": (
        "issue date",
        "issued on",
        "date of issue",
        "issued date",
        "date",
    ),
    "expiration_date": (
        "expiration date",
        "expiry date",
        "expires",
        "expires on",
        "valid until",
        "valid thru",
        "valid through",
    ),
    "certificate_id": (
        "certificate id",
        "certificate number",
        "credential id",
        "credential number",
        "serial number",
        "registration number",
        "id",
        "document id",
    ),
    "qr_code": (
        "qr code",
        "qr",
        "barcode",
        "verification url",
        "verify url",
    ),
}


def map_document_intelligence_result(analyze_result: dict[str, Any]) -> OcrExtractedFields:
    """Map Azure Document Intelligence analyzeResult into normalized OCR fields."""
    key_value_pairs = _extract_key_value_pairs(analyze_result)
    detected_text = _extract_detected_text(analyze_result)

    mapped: dict[str, str | None] = {key: None for key in _FIELD_ALIASES}
    for field_name, aliases in _FIELD_ALIASES.items():
        mapped[field_name] = _match_field(key_value_pairs, aliases)

    # Fallback: light heuristics from free text when key-value pairs miss fields.
    if not mapped["holder_name"]:
        mapped["holder_name"] = _heuristic_holder(detected_text)
    if not mapped["issue_date"] and not mapped["award_date"]:
        mapped["issue_date"] = _heuristic_date(detected_text)

    return OcrExtractedFields(
        holder_name=mapped["holder_name"],
        certificate_name=mapped["certificate_name"],
        issuer=mapped["issuer"],
        award_date=mapped["award_date"],
        issue_date=mapped["issue_date"],
        expiration_date=mapped["expiration_date"],
        certificate_id=mapped["certificate_id"],
        qr_code=mapped["qr_code"],
        detected_text=detected_text or None,
        key_value_pairs=key_value_pairs,
        raw={
            "api": "azure_document_intelligence",
            "page_count": len(analyze_result.get("pages") or []),
            "has_key_value_pairs": bool(key_value_pairs),
        },
    )


def _extract_key_value_pairs(analyze_result: dict[str, Any]) -> dict[str, str]:
    pairs: dict[str, str] = {}
    for item in analyze_result.get("keyValuePairs") or []:
        if not isinstance(item, dict):
            continue
        key = _content_of(item.get("key"))
        value = _content_of(item.get("value"))
        if key and value:
            pairs[key] = value

    # Documents / fields style (prebuilt models sometimes expose documents[].fields)
    for document in analyze_result.get("documents") or []:
        if not isinstance(document, dict):
            continue
        fields = document.get("fields")
        if not isinstance(fields, dict):
            continue
        for name, field in fields.items():
            value = _field_value(field)
            if name and value:
                pairs[str(name)] = value

    return pairs


def _extract_detected_text(analyze_result: dict[str, Any]) -> str:
    content = analyze_result.get("content")
    if isinstance(content, str) and content.strip():
        return content.strip()

    lines: list[str] = []
    for page in analyze_result.get("pages") or []:
        if not isinstance(page, dict):
            continue
        for line in page.get("lines") or []:
            if isinstance(line, dict):
                text = line.get("content")
                if isinstance(text, str) and text.strip():
                    lines.append(text.strip())
    return "\n".join(lines)


def _content_of(node: Any) -> str | None:
    if isinstance(node, dict):
        content = node.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    return None


def _field_value(field: Any) -> str | None:
    if not isinstance(field, dict):
        return None
    for key in ("content", "valueString", "valueDate", "valuePhoneNumber", "valueCountryRegion"):
        value = field.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    value_number = field.get("valueNumber")
    if isinstance(value_number, (int, float)):
        return str(value_number)
    return _content_of(field)


def _normalize_label(label: str) -> str:
    return re.sub(r"\s+", " ", label.strip().lower().replace("_", " ").replace(":", ""))


def _match_field(pairs: dict[str, str], aliases: tuple[str, ...]) -> str | None:
    normalized_pairs = {_normalize_label(k): v for k, v in pairs.items()}
    for alias in aliases:
        if alias in normalized_pairs and normalized_pairs[alias].strip():
            return normalized_pairs[alias].strip()
    for key, value in normalized_pairs.items():
        for alias in aliases:
            if alias in key and value.strip():
                return value.strip()
    return None


def _heuristic_holder(text: str) -> str | None:
    if not text:
        return None
    patterns = (
        r"(?:awarded to|presented to|this is to certify that)\s*[:\-]?\s*([A-Z][A-Za-z .'-]{2,60})",
        r"(?:student name|recipient|holder)\s*[:\-]\s*([A-Za-z .'-]{2,60})",
    )
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def _heuristic_date(text: str) -> str | None:
    if not text:
        return None
    match = re.search(
        r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"
        r"|\d{4}[/-]\d{1,2}[/-]\d{1,2}"
        r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b",
        text,
        flags=re.IGNORECASE,
    )
    return match.group(0) if match else None
