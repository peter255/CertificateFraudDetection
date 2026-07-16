from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO

from PIL import Image

from app.application.dto.pdf_structure import OcrExtractedFields, PdfMetadata, PdfStructureFinding
from app.application.services.pdf_structure.metadata_validation import (
    build_file_information,
    build_metadata_recommendations,
    findings_to_metadata_flags,
    merge_certificate_flags,
    run_metadata_validation,
)


def _png_bytes(width: int, height: int) -> bytes:
    image = Image.new("RGBA", (width, height), color=(10, 20, 30, 255))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_resolve_producer_from_fuzzy_document_property_key() -> None:
    info = build_file_information(
        content=_png_bytes(40, 40),
        filename="cert.png",
        metadata=PdfMetadata(
            is_pdf=False,
            file_size=40,
            document_properties={"exif_software": "Adobe Photoshop 26.0"},
        ),
    )
    assert info.producer == "Adobe Photoshop 26.0"


def test_build_file_information_keeps_upload_date_separate_from_embedded_dates() -> None:
    info = build_file_information(
        content=_png_bytes(100, 80),
        filename="cert.png",
        content_type="image/png",
        file_modified="2026-07-09T11:11:12.000Z",
        metadata=PdfMetadata(
            file_type="PNG",
            file_size=100,
            is_pdf=False,
            creator="Adobe Photoshop",
            document_properties={"image_width": 100, "image_height": 80},
        ),
    )
    assert info.creation_date is None
    assert info.modification_date is None
    assert info.file_modified == "2026-07-09T11:11:12.000Z"
    assert info.producer == "Adobe Photoshop"


def test_build_file_information_reextracts_unsupported_png_metadata() -> None:
    info = build_file_information(
        content=_png_bytes(320, 200),
        filename="testtest.png",
        content_type="image/png",
        metadata=PdfMetadata(
            file_type="PNG",
            file_size=1043322,
            is_pdf=False,
            document_properties={"note": "Unsupported format — PDF/JPEG metadata extraction skipped"},
        ),
    )
    assert info.document_properties.get("image_width") == 320
    assert info.document_properties.get("image_height") == 200
    assert info.document_properties.get("color_mode") == "RGBA"
    assert "Unsupported format" not in str(info.document_properties.get("note", ""))


def test_build_file_information_includes_filename_and_mime_type() -> None:
    info = build_file_information(
        content=b"%PDF-1.4",
        filename="cert.pdf",
        content_type="application/pdf",
        metadata=PdfMetadata(file_size=12, is_pdf=True, page_count=1),
    )
    assert info.filename == "cert.pdf"
    assert info.mime_type == "application/pdf"
    assert info.file_size_bytes == 12


def test_build_file_information_includes_metadata_fields() -> None:
    info = build_file_information(
        content=b"%PDF-1.4",
        filename="cert.pdf",
        metadata=PdfMetadata(
            file_size=12,
            is_pdf=True,
            page_count=2,
            creation_date="2024-01-01T10:00:00",
            modification_date="2024-06-01T10:00:00",
            producer="Adobe Acrobat",
            creator="Microsoft Word",
            editing_producer="Adobe Acrobat",
            pdf_version="1.7",
            title="Certificate",
            author="Issuer",
            document_properties={"camera_model": "Canon"},
        ),
    )
    assert info.file_type == "PDF"
    assert info.num_pages == 2
    assert info.creation_date == "2024-01-01T10:00:00"
    assert info.producer == "Adobe Acrobat"
    assert info.document_properties == {"camera_model": "Canon"}


def test_build_file_information_resolves_modification_date_from_properties() -> None:
    info = build_file_information(
        content=b"%PDF-1.4",
        filename="cert.pdf",
        metadata=PdfMetadata(
            is_pdf=True,
            file_size=12,
            document_properties={"document_modification_date": "2024-06-01T10:00:00"},
        ),
    )
    assert info.modification_date == "2024-06-01T10:00:00"


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


def test_build_metadata_recommendations_includes_description() -> None:
    findings = [
        PdfStructureFinding(
            rule_id="PDF_EDITING_SOFTWARE_DETECTED",
            severity="warning",
            status="warning",
            title="Editing software detected in file metadata",
            description="The file producer references editing software.",
            recommendation="Review provenance and compare against issuer records.",
        )
    ]
    recs = build_metadata_recommendations(findings)
    assert len(recs) == 1
    assert recs[0].recommendation == "Review provenance and compare against issuer records."
    assert recs[0].description == "The file producer references editing software."
