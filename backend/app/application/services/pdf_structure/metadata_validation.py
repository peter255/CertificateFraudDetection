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
    ReportRecommendation,
)
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.rules.registry import build_default_rule_registry
from app.infrastructure.pdf.metadata_extractor import PypdfMetadataExtractor

_metadata_extractor = PypdfMetadataExtractor()


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


def _pick_metadata_string(metadata: PdfMetadata | None, *keys: str) -> str | None:
    if metadata is None:
        return None
    props = metadata.document_properties or {}
    for key in keys:
        direct = getattr(metadata, key, None)
        if isinstance(direct, str) and direct.strip():
            return direct.strip()
        value = props.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _resolve_creation_date(metadata: PdfMetadata | None) -> str | None:
    embedded = _pick_metadata_string(
        metadata,
        "creation_date",
        "document_creation_date",
        "CreationDate",
        "/CreationDate",
        "exif_datetime_original",
        "xmp_create_date",
        "creation_time",
        "png_date",
        "date",
    )
    if embedded:
        return embedded
    if metadata and metadata.file_modified:
        return metadata.file_modified.strip()
    return None


def _resolve_modification_date(metadata: PdfMetadata | None) -> str | None:
    embedded = _pick_metadata_string(
        metadata,
        "modification_date",
        "document_modification_date",
        "ModDate",
        "/ModDate",
        "exif_datetime_modified",
        "xmp_modify_date",
        "exif_datetime_digitized",
        "modification_time",
    )
    if embedded:
        return embedded
    if metadata and metadata.file_modified:
        return metadata.file_modified.strip()
    return None


def _resolve_producer(metadata: PdfMetadata | None) -> str | None:
    direct = _pick_metadata_string(
        metadata,
        "producer",
        "editing_producer",
        "software",
        "creator",
        "/Producer",
        "Producer",
        "editing_software_xmp",
        "exif_software",
    )
    if direct:
        return direct
    if metadata is None:
        return None
    for key, value in (metadata.document_properties or {}).items():
        key_l = str(key).lower()
        if any(token in key_l for token in ("software", "producer", "creatortool", "creator_tool")):
            if isinstance(value, str):
                text = value.strip()
            elif value is not None:
                text = str(value).strip()
            else:
                text = ""
            if text:
                return text
    return _pick_metadata_string(metadata, "creator")


def _ensure_metadata(
    *,
    content: bytes,
    filename: str,
    metadata: PdfMetadata | None,
) -> PdfMetadata:
    if metadata is not None:
        props = metadata.document_properties or {}
        note = str(props.get("note") or "")
        if note.startswith("Unsupported format"):
            return _metadata_extractor.extract(
                content,
                filename=filename,
                file_size=len(content),
            )
        if (
            props.get("image_width")
            or props.get("image_height")
            or metadata.creation_date
            or metadata.modification_date
            or metadata.producer
            or metadata.creator
            or metadata.page_count
            or metadata.is_pdf
        ):
            return metadata
    return _metadata_extractor.extract(
        content,
        filename=filename,
        file_size=len(content),
    )


def build_file_information(
    *,
    content: bytes,
    filename: str,
    metadata: PdfMetadata | None,
    content_type: str | None = None,
    file_modified: str | None = None,
) -> FileInformation:
    is_pdf = bool(metadata and metadata.is_pdf)
    resolved_metadata = _ensure_metadata(content=content, filename=filename, metadata=metadata)
    if metadata is not None:
        merged_props = {
            **(metadata.document_properties or {}),
            **(resolved_metadata.document_properties or {}),
        }
        if merged_props.get("image_width") or merged_props.get("image_height"):
            merged_props.pop("note", None)
        resolved_metadata = resolved_metadata.model_copy(
            update={
                "document_properties": merged_props,
                "producer": resolved_metadata.producer or metadata.producer,
                "creator": resolved_metadata.creator or metadata.creator,
                "editing_producer": resolved_metadata.editing_producer or metadata.editing_producer,
            }
        )
    if file_modified:
        resolved_metadata = resolved_metadata.model_copy(update={"file_modified": file_modified})
    is_pdf = bool(resolved_metadata.is_pdf)
    file_type = (resolved_metadata.file_type if resolved_metadata.file_type else None) or file_type_from_filename(
        filename,
        is_pdf=is_pdf,
    )
    size_bytes = resolved_metadata.file_size if resolved_metadata.file_size else len(content)
    pages = resolved_metadata.page_count if resolved_metadata.page_count else None
    num_pages = max(1, int(pages)) if pages is not None else 1
    return FileInformation(
        file_type=file_type,
        file_size=human_file_size(size_bytes),
        file_size_bytes=size_bytes,
        num_pages=num_pages,
        filename=filename or None,
        mime_type=(content_type or "").strip() or None,
        creation_date=_resolve_creation_date(resolved_metadata),
        modification_date=_resolve_modification_date(resolved_metadata),
        file_modified=file_modified or resolved_metadata.file_modified,
        producer=_resolve_producer(resolved_metadata),
        creator=resolved_metadata.creator if resolved_metadata else None,
        editing_producer=resolved_metadata.editing_producer if resolved_metadata else None,
        pdf_version=resolved_metadata.pdf_version if resolved_metadata else None,
        title=resolved_metadata.title if resolved_metadata else None,
        author=resolved_metadata.author if resolved_metadata else None,
        subject=resolved_metadata.subject if resolved_metadata else None,
        keywords=resolved_metadata.keywords if resolved_metadata else None,
        is_pdf=resolved_metadata.is_pdf if resolved_metadata else is_pdf,
        parse_error=resolved_metadata.parse_error if resolved_metadata else None,
        document_properties=dict(resolved_metadata.document_properties) if resolved_metadata else {},
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


def build_metadata_recommendations(findings: list[PdfStructureFinding]) -> list[ReportRecommendation]:
    recs: list[ReportRecommendation] = []
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
        recs.append(
            ReportRecommendation(
                recommendation=text,
                description=(item.description or "").strip(),
            )
        )
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
