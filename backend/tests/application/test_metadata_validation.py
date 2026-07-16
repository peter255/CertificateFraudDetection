from __future__ import annotations

from datetime import datetime, timezone

from app.application.dto.pdf_structure import OcrExtractedFields, PdfMetadata
from app.application.services.pdf_structure.metadata_validation import (
    build_file_information,
    findings_to_metadata_flags,
    merge_certificate_flags,
    run_metadata_validation,
)


def test_build_file_information_defaults_pages_to_one() -> None:
    info = build_file_information(
        content=b"%PDF-1.4",
        filename="cert.pdf",
        metadata=PdfMetadata(file_size=12, is_pdf=True, page_count=None),
    )
    assert info.file_type == "PDF"
    assert info.num_pages == 1


def test_modification_before_creation_produces_metadata_flag() -> None:
    metadata = PdfMetadata(
        is_pdf=True,
        creation_date="2024-06-01T10:00:00",
        modification_date="2024-01-01T10:00:00",
        producer="Adobe Acrobat",
        creator="Adobe Acrobat",
    )
    findings = run_metadata_validation(ocr=OcrExtractedFields(), metadata=metadata)
    flags = findings_to_metadata_flags(findings)
    assert any("Modification date before creation date" in flag for flag in flags)


def test_editing_software_detected_for_photoshop_producer() -> None:
    metadata = PdfMetadata(
        is_pdf=True,
        producer="Adobe Photoshop 25.0",
        creator="Adobe Photoshop 25.0",
        editing_producer="Adobe Photoshop 25.0",
        modification_date=datetime(2024, 5, 1, tzinfo=timezone.utc).isoformat(),
    )
    findings = run_metadata_validation(ocr=OcrExtractedFields(), metadata=metadata)
    flags = findings_to_metadata_flags(findings)
    assert any("Editing software detected" in flag for flag in flags)


def test_merge_certificate_flags_preserves_vendor_and_metadata() -> None:
    merged = merge_certificate_flags(
        ["invalid_provenance", "visual_copy_move_region"],
        ["Modification date before creation date: example"],
    )
    assert merged == [
        "invalid_provenance",
        "visual_copy_move_region",
        "Modification date before creation date: example",
    ]
