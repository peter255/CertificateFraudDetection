"""Unit tests for metadata-only Document Intelligence / File Structure summary."""

from __future__ import annotations

from app.application.dto.pdf_structure import PdfMetadata
from app.application.services.pdf_structure.metadata_compare import (
    build_metadata_compare_summary,
    find_vendor_pdf_metadata,
    normalize_vendor_metadata,
)


def test_find_vendor_pdf_metadata_prefers_nested_shape() -> None:
    payload = {
        "engine_results": {
            "other": {"creation_date": "ignored"},
            "pdf_metadata": {
                "skipped": False,
                "metadata": {
                    "fonts": ["AAAAAA+SegoeUI-Bold", "BAAAAA+SegoeUI"],
                    "author": "",
                    "creator": "Mozilla/5.0 Chrome/150",
                    "producer": "Skia/PDF m150",
                    "font_count": 3,
                    "page_count": 1,
                    "creation_date": "D:20260711134234+00'00'",
                    "has_javascript": False,
                    "modification_date": "D:20260711134234+00'00'",
                },
                "risk_score": 0.0,
                "neutralized_for_scan": False,
            },
        }
    }
    found = find_vendor_pdf_metadata(payload)
    assert found is not None
    assert found["skipped"] is False
    assert found["metadata"]["producer"] == "Skia/PDF m150"

    flat = normalize_vendor_metadata(found)
    assert flat["creation_date"] == "D:20260711134234+00'00'"
    assert flat["modification_date"] == "D:20260711134234+00'00'"
    assert flat["producer"] == "Skia/PDF m150"
    assert flat["page_count"] == 1
    assert flat["font_count"] == 3
    assert flat["fonts"] == ["AAAAAA+SegoeUI-Bold", "BAAAAA+SegoeUI"]


def test_summary_clean_agreement() -> None:
    vendor = {
        "skipped": False,
        "metadata": {
            "creation_date": "D:20260711134234+00'00'",
            "modification_date": "D:20260711134234+00'00'",
            "creator": "Mozilla/5.0",
            "producer": "Skia/PDF m150",
            "page_count": 1,
        },
        "risk_score": 0.0,
        "neutralized_for_scan": False,
    }
    analyze = PdfMetadata(
        is_pdf=True,
        creation_date="D:20260711134234+00'00'",
        modification_date="D:20260711134234+00'00'",
        creator="Mozilla/5.0",
        producer="Skia/PDF m150",
        page_count=1,
    )
    summary = build_metadata_compare_summary(vendor, analyze)
    assert "consistent" in summary.lower()
    assert "does not match" not in summary.lower()


def test_summary_vendor_mod_before_creation() -> None:
    vendor = {
        "metadata": {
            "creation_date": "D:20260711140000+00'00'",
            "modification_date": "D:20260711120000+00'00'",
            "producer": "Skia/PDF m150",
        }
    }
    analyze = PdfMetadata(
        is_pdf=True,
        creation_date="D:20260711140000+00'00'",
        modification_date="D:20260711120000+00'00'",
        producer="Skia/PDF m150",
    )
    summary = build_metadata_compare_summary(vendor, analyze)
    assert "modification date earlier" in summary.lower()


def test_summary_cross_source_date_mismatch() -> None:
    vendor = {
        "metadata": {
            "creation_date": "D:20260711134234+00'00'",
            "modification_date": "D:20260711134234+00'00'",
            "producer": "Skia/PDF m150",
            "page_count": 1,
        }
    }
    analyze = PdfMetadata(
        is_pdf=True,
        creation_date="D:20250101100000Z",
        modification_date="D:20260711134234+00'00'",
        producer="Skia/PDF m150",
        page_count=1,
    )
    summary = build_metadata_compare_summary(vendor, analyze)
    assert "creation date does not match" in summary.lower()
    assert "pdf-structure analysis" in summary.lower()


def test_summary_analyze_only_when_vendor_missing() -> None:
    analyze = PdfMetadata(
        is_pdf=True,
        creation_date="D:20260711134234+00'00'",
        modification_date="D:20260711134234+00'00'",
        producer="Skia/PDF m150",
    )
    summary = build_metadata_compare_summary(None, analyze)
    assert "internally consistent" in summary.lower()
    assert "no vendor" in summary.lower()


def test_summary_producer_mismatch() -> None:
    vendor = {
        "metadata": {
            "creation_date": "D:20260711134234+00'00'",
            "modification_date": "D:20260711134234+00'00'",
            "producer": "Skia/PDF m150",
        }
    }
    analyze = PdfMetadata(
        is_pdf=True,
        creation_date="D:20260711134234+00'00'",
        modification_date="D:20260711134234+00'00'",
        producer="Adobe PDF Library",
    )
    summary = build_metadata_compare_summary(vendor, analyze)
    assert "producer does not match" in summary.lower()
