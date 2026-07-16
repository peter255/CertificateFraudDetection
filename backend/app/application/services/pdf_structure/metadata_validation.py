"""
Metadata validation aligned with metadata.ipynb.

Builds forensic metadata flags, file-information payload, and recommendations
from deterministic PDF structure findings.
"""

from __future__ import annotations

from pathlib import Path

from app.application.dto.pdf_structure import (
    FileInformation,
    OcrExtractedFields,
    PdfMetadata,
    PdfStructureFinding,
)
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.rules.registry import build_default_rule_registry


def human_file_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} PB"


def file_type_from_filename(filename: str, *, is_pdf: bool) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf" or is_pdf:
        return "PDF"
    if ext in {".jpg", ".jpeg"}:
        return "JPEG"
    if ext:
        return ext.lstrip(".").upper()
    return "UNKNOWN"


def build_file_information(
    *,
    content: bytes,
    filename: str,
    metadata: PdfMetadata | None,
) -> FileInformation:
    is_pdf = bool(metadata and metadata.is_pdf)
    file_type = (metadata.file_type if metadata and metadata.file_type else None) or file_type_from_filename(
        filename,
        is_pdf=is_pdf,
    )
    size_bytes = metadata.file_size if metadata and metadata.file_size else len(content)
    pages = metadata.page_count if metadata and metadata.page_count else None
    num_pages = max(1, int(pages)) if pages is not None else 1
    return FileInformation(
        file_type=file_type,
        file_size=human_file_size(size_bytes),
        file_size_bytes=size_bytes,
        num_pages=num_pages,
    )


def run_metadata_validation(
    *,
    ocr: OcrExtractedFields,
    metadata: PdfMetadata,
    filename: str = "",
    content_type: str | None = None,
) -> list[PdfStructureFinding]:
    """Evaluate metadata.ipynb-aligned forensic rules and return findings."""
    context = PdfStructureContext(
        ocr=ocr,
        metadata=metadata,
        filename=filename,
        content_type=content_type,
    )
    return build_default_rule_registry().evaluate_all(context)


def findings_to_metadata_flags(findings: list[PdfStructureFinding]) -> list[str]:
    """Human-readable metadata flags for Certificate Flags / Summary context."""
    flags: list[str] = []
    seen: set[str] = set()
    for item in findings:
        if item.severity == "info" and item.status == "pass":
            continue
        text = f"{item.title}: {item.description}".strip()
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        flags.append(text)
    return flags


def build_metadata_recommendations(findings: list[PdfStructureFinding]) -> list[str]:
    recs: list[str] = []
    seen: set[str] = set()
    for item in findings:
        if item.severity == "info":
            continue
        text = (item.recommendation or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        recs.append(text)
    return recs


def merge_certificate_flags(
    vendor_flags: list[str],
    metadata_flags: list[str],
) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for flag in [*vendor_flags, *metadata_flags]:
        key = flag.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(flag.strip())
    return merged
