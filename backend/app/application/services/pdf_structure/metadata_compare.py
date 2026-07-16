"""
Deterministic PDF metadata comparison for File Structure / Document Intelligence summary.

Compares vendor nested ``pdf_metadata`` (and its internal dates) against metadata
from ``/api/v1/pdf-structure/analyze``. Does not use OCR or identity fields.
"""

from __future__ import annotations

from typing import Any, Mapping

from app.application.dto.pdf_structure import PdfMetadata
from app.application.services.pdf_structure.date_utils import parse_flexible_datetime

_COMPARE_FIELDS = ("creator", "producer", "page_count")
_DATE_FIELDS = ("creation_date", "modification_date")
_NESTED_META_KEYS = (
    "creation_date",
    "modification_date",
    "creator",
    "producer",
    "author",
    "page_count",
    "fonts",
    "font_count",
    "has_javascript",
)

_MAX_SEARCH_NODES = 400


def find_vendor_pdf_metadata(*payloads: Any) -> dict[str, Any] | None:
    """
    Recursively locate a nested vendor ``pdf_metadata`` object.

    Prefers objects shaped like::

        {"skipped": false, "metadata": {...}, "risk_score": 0.0, "neutralized_for_scan": false}
    """
    best: dict[str, Any] | None = None
    best_score = -1
    visited = 0

    def walk(node: Any) -> None:
        nonlocal best, best_score, visited
        if visited >= _MAX_SEARCH_NODES:
            return
        if isinstance(node, dict):
            visited += 1
            candidate = node.get("pdf_metadata")
            if isinstance(candidate, dict):
                score = _vendor_meta_score(candidate)
                if score > best_score:
                    best = candidate
                    best_score = score
            for value in node.values():
                if visited >= _MAX_SEARCH_NODES:
                    return
                if isinstance(value, (dict, list)):
                    walk(value)
        elif isinstance(node, list):
            visited += 1
            for item in node:
                if visited >= _MAX_SEARCH_NODES:
                    return
                if isinstance(item, (dict, list)):
                    walk(item)

    for payload in payloads:
        if payload is not None:
            walk(payload)
    return best


def normalize_vendor_metadata(raw: Mapping[str, Any] | None) -> dict[str, Any]:
    """Flatten vendor pdf_metadata (nested ``metadata`` or flat) into comparable fields."""
    if not isinstance(raw, Mapping):
        return {}

    nested = raw.get("metadata") if isinstance(raw.get("metadata"), Mapping) else None
    source: Mapping[str, Any] = nested if nested is not None else raw

    out: dict[str, Any] = {}
    for key in _NESTED_META_KEYS:
        value = source.get(key)
        if value is None and nested is None:
            value = raw.get(key)
        if value is None or value == "":
            continue
        if key == "page_count":
            try:
                out[key] = int(value)
            except (TypeError, ValueError):
                continue
        elif key == "font_count":
            try:
                out[key] = int(value)
            except (TypeError, ValueError):
                continue
        elif key == "has_javascript":
            out[key] = bool(value)
        elif key == "fonts":
            if isinstance(value, list):
                out[key] = [str(item) for item in value if item is not None]
        else:
            text = str(value).strip()
            if text:
                out[key] = text

    if "skipped" in raw:
        out["skipped"] = bool(raw.get("skipped"))
    return out


def normalize_analyze_metadata(metadata: PdfMetadata | Mapping[str, Any] | None) -> dict[str, Any]:
    """Normalize analyze-pipeline metadata into the same flat compare shape."""
    if metadata is None:
        return {}
    if isinstance(metadata, Mapping) and (
        "num_pages" in metadata or "file_size_bytes" in metadata
    ):
        return file_information_to_compare_metadata(metadata)
    if isinstance(metadata, PdfMetadata):
        data = metadata.model_dump()
    elif isinstance(metadata, Mapping):
        data = dict(metadata)
    else:
        return {}

    out: dict[str, Any] = {}
    for key in ("creation_date", "modification_date", "creator", "producer", "author"):
        value = data.get(key)
        if value is None or value == "":
            continue
        text = str(value).strip()
        if text:
            out[key] = text
    page_count = data.get("page_count")
    if page_count is not None:
        try:
            out["page_count"] = int(page_count)
        except (TypeError, ValueError):
            pass
    return out


def file_information_to_compare_metadata(
    file_info: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """
    Map the displayed File Information payload to pdf-structure compare metadata.

    Keeps vendor/metadata comparison and AI prompts aligned with what the UI shows.
    """
    if not file_info:
        return {}

    data = dict(file_info)
    out: dict[str, Any] = {}
    for key in (
        "creation_date",
        "modification_date",
        "producer",
        "creator",
        "author",
        "file_modified",
        "file_type",
        "title",
        "subject",
        "keywords",
        "pdf_version",
        "editing_producer",
        "parse_error",
    ):
        value = data.get(key)
        if value is None or value == "":
            continue
        text = str(value).strip()
        if text:
            out[key] = text

    pages = data.get("num_pages", data.get("page_count"))
    if pages is not None:
        try:
            out["page_count"] = int(pages)
        except (TypeError, ValueError):
            pass

    if data.get("file_size_bytes") is not None:
        try:
            out["file_size"] = int(data["file_size_bytes"])
        except (TypeError, ValueError):
            pass

    if data.get("is_pdf") is not None:
        out["is_pdf"] = bool(data.get("is_pdf"))

    props = data.get("document_properties")
    if isinstance(props, Mapping) and props:
        out["document_properties"] = dict(props)

    return out


def build_metadata_compare_summary(
    vendor_raw: Mapping[str, Any] | None,
    analyze_metadata: PdfMetadata | Mapping[str, Any] | None,
) -> str:
    """
    Build a short plain-English summary of metadata date/field agreement and mismatches.
    """
    vendor = normalize_vendor_metadata(vendor_raw)
    analyze = normalize_analyze_metadata(analyze_metadata)

    mismatches: list[str] = []

    vendor_chrono = _chronology_issue(vendor, source_label="Vendor")
    if vendor_chrono:
        mismatches.append(vendor_chrono)

    analyze_chrono = _chronology_issue(analyze, source_label="PDF structure analysis")
    if analyze_chrono:
        mismatches.append(analyze_chrono)

    for field in _DATE_FIELDS:
        mismatch = _date_cross_mismatch(vendor, analyze, field)
        if mismatch:
            mismatches.append(mismatch)

    for field in _COMPARE_FIELDS:
        mismatch = _field_cross_mismatch(vendor, analyze, field)
        if mismatch:
            mismatches.append(mismatch)

    if not vendor and not analyze:
        return (
            "No PDF metadata was available from the verification engine or "
            "pdf-structure analysis for comparison."
        )

    if not mismatches:
        if vendor and analyze:
            return (
                "Metadata timestamps and key fields are consistent between the "
                "verification engine and pdf-structure analysis."
            )
        if vendor:
            return (
                "Vendor PDF metadata timestamps are internally consistent. "
                "No pdf-structure analysis metadata was available for cross-check."
            )
        return (
            "PDF structure analysis metadata timestamps are internally consistent. "
            "No vendor PDF metadata was available for cross-check."
        )

    # Cap to keep the File Structure card readable.
    lines = mismatches[:4]
    return " ".join(lines)


def _vendor_meta_score(candidate: Mapping[str, Any]) -> int:
    score = 0
    nested = candidate.get("metadata")
    if isinstance(nested, Mapping):
        score += 5
        for key in ("creation_date", "modification_date", "creator", "producer", "fonts"):
            if nested.get(key) not in (None, "", [], {}):
                score += 1
    for key in ("skipped", "risk_score", "neutralized_for_scan"):
        if key in candidate:
            score += 2
    for key in ("creation_date", "modification_date", "creator", "producer"):
        if candidate.get(key) not in (None, "", [], {}):
            score += 1
    return score


def _chronology_issue(meta: Mapping[str, Any], *, source_label: str) -> str | None:
    created = parse_flexible_datetime(_as_str(meta.get("creation_date")))
    modified = parse_flexible_datetime(_as_str(meta.get("modification_date")))
    if created is None or modified is None:
        return None
    if modified < created:
        return (
            f"{source_label} metadata has a modification date earlier than the "
            f"creation date ({meta.get('modification_date')} before {meta.get('creation_date')})."
        )
    return None


def _date_cross_mismatch(
    vendor: Mapping[str, Any],
    analyze: Mapping[str, Any],
    field: str,
) -> str | None:
    left_raw = _as_str(vendor.get(field))
    right_raw = _as_str(analyze.get(field))
    if not left_raw or not right_raw:
        return None
    left = parse_flexible_datetime(left_raw)
    right = parse_flexible_datetime(right_raw)
    if left is None or right is None:
        if left_raw.strip() != right_raw.strip():
            label = field.replace("_", " ")
            return (
                f"The {label} does not match pdf-structure analysis "
                f"(vendor: {left_raw}; analysis: {right_raw})."
            )
        return None
    if left != right:
        label = field.replace("_", " ")
        return (
            f"The {label} does not match pdf-structure analysis "
            f"(vendor: {left_raw}; analysis: {right_raw})."
        )
    return None


def _field_cross_mismatch(
    vendor: Mapping[str, Any],
    analyze: Mapping[str, Any],
    field: str,
) -> str | None:
    left = vendor.get(field)
    right = analyze.get(field)
    if left in (None, "") or right in (None, ""):
        return None
    if field == "page_count":
        try:
            if int(left) != int(right):
                return (
                    f"Page count does not match pdf-structure analysis "
                    f"(vendor: {left}; analysis: {right})."
                )
        except (TypeError, ValueError):
            return None
        return None

    left_text = str(left).strip().lower()
    right_text = str(right).strip().lower()
    if left_text != right_text:
        label = field.replace("_", " ").capitalize()
        return (
            f"{label} does not match pdf-structure analysis "
            f"(vendor: {left}; analysis: {right})."
        )
    return None


def _as_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
