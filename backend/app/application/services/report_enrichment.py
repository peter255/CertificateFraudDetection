"""Shared report enrichment for vendor verify endpoints."""

from __future__ import annotations

from typing import Any

from app.application.dto.pdf_structure import PdfStructureAnalyzeResponse
from app.application.services.pdf_structure.metadata_validation import (
    build_file_information,
    findings_to_metadata_flags,
    merge_certificate_flags,
)


def build_report_enrichment(
    *,
    vendor_flags: list[str],
    pdf_structure_analysis: PdfStructureAnalyzeResponse | None,
    filename: str,
    content: bytes,
    content_type: str | None = None,
    file_modified: str | None = None,
) -> dict[str, Any]:
    metadata_flags: list[str] = []
    file_info = build_file_information(
        content=content,
        filename=filename,
        metadata=pdf_structure_analysis.pdf_metadata if pdf_structure_analysis else None,
        content_type=content_type,
        file_modified=file_modified,
    )

    if pdf_structure_analysis is not None:
        metadata_flags = findings_to_metadata_flags(pdf_structure_analysis.findings)

    certificate_flags = merge_certificate_flags(vendor_flags, metadata_flags)

    return {
        "vendor_flags": vendor_flags,
        "metadata_flags": metadata_flags,
        "certificate_flags": certificate_flags,
        "file_information": file_info.model_dump(),
    }
