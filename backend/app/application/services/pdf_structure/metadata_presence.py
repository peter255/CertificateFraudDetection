"""Embedded metadata presence checks shared by rules and contextual indicators."""

from __future__ import annotations

from app.application.dto.pdf_structure import PdfMetadata


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


def resolve_embedded_creation_date(metadata: PdfMetadata | None) -> str | None:
    """Creation date from embedded file metadata only (no upload timestamp fallback)."""
    return _pick_metadata_string(
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


def resolve_embedded_modification_date(metadata: PdfMetadata | None) -> str | None:
    """Modification date from embedded file metadata only (no upload timestamp fallback)."""
    return _pick_metadata_string(
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


def resolve_embedded_producer(metadata: PdfMetadata | None) -> str | None:
    """Producer from embedded metadata only (no creator fallback)."""
    return _pick_metadata_string(
        metadata,
        "producer",
        "editing_producer",
        "/Producer",
        "Producer",
        "editing_software_xmp",
        "exif_software",
    )


def resolve_embedded_creator(metadata: PdfMetadata | None) -> str | None:
    """Creator from embedded metadata only."""
    return _pick_metadata_string(metadata, "creator", "/Creator", "Creator")


def metadata_core_embedded_present(metadata: PdfMetadata | None) -> bool:
    """True when at least one core embedded metadata anchor exists."""
    if metadata is None:
        return False
    return bool(
        resolve_embedded_creation_date(metadata)
        or resolve_embedded_modification_date(metadata)
        or resolve_embedded_producer(metadata)
        or resolve_embedded_creator(metadata)
        or (metadata.title or "").strip()
        or (metadata.author or "").strip()
        or (metadata.subject or "").strip()
    )
