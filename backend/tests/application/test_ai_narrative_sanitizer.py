from __future__ import annotations

from app.application.services.ai_summary_enrichment import (
    _filter_contradictory_flag_tags,
    _narrative_contradicts_file_information,
    _sanitize_file_context,
    sanitize_narrative_text,
)


def test_sanitize_narrative_text_removes_png_vs_pdf_sentence() -> None:
    raw = (
        "Editing software was detected in metadata. "
        "However, the file is a PNG image, not a native PDF. "
        "Producer references Adobe Photoshop."
    )
    cleaned = sanitize_narrative_text(raw)
    assert cleaned is not None
    assert "png" not in cleaned.lower()
    assert "native pdf" not in cleaned.lower()
    assert "Adobe Photoshop" in cleaned


def test_sanitize_narrative_text_removes_incomplete_claims() -> None:
    raw = (
        "Metadata is incomplete for this submission. "
        "Producer references Canva, which is uncommon for issued certificates."
    )
    cleaned = sanitize_narrative_text(raw)
    assert cleaned is not None
    assert "incomplete" not in cleaned.lower()
    assert "Canva" in cleaned


def test_sanitize_file_context_drops_format_apology_fields() -> None:
    payload = {
        "file_type": "PNG",
        "is_pdf": False,
        "producer": "Adobe Photoshop",
        "parse_error": "Unsupported format",
        "document_properties": {
            "image_width": 1920,
            "note": "Unsupported format — metadata extraction skipped",
        },
    }
    cleaned = _sanitize_file_context(payload)
    assert cleaned["file_type"] == "PNG"
    assert "is_pdf" not in cleaned
    assert "parse_error" not in cleaned
    assert "note" not in cleaned.get("document_properties", {})


def test_filter_contradictory_flag_tags_drops_missing_creation_when_date_shown() -> None:
    flags = [
        "MISSING_CERTIFICATE_ID",
        "MISSING_CREATION_DATE",
        "OCR_MISSING_IMPORTANT_FIELDS",
    ]
    file_info = {"creation_date": "2026-07-08T08:25:22.000Z", "producer": "Adobe Scan for iOS"}
    filtered = _filter_contradictory_flag_tags(flags, file_info)
    assert "MISSING_CREATION_DATE" not in filtered
    assert "MISSING_CERTIFICATE_ID" in filtered


def test_narrative_contradicts_file_information_detects_empty_metadata_claim() -> None:
    file_info = {
        "creation_date": "2026-07-08T08:25:22.000Z",
        "producer": "Adobe Scan for iOS 26.03.19",
    }
    summary = (
        "Core PDF metadata and identity anchors are empty or stripped while file "
        "timestamps align to the scan producer."
    )
    assert _narrative_contradicts_file_information(summary, file_info) is True
