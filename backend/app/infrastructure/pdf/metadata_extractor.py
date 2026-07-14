from __future__ import annotations

from io import BytesIO
from typing import Any

from pypdf import PdfReader
from pypdf.generic import IndirectObject

from app.application.dto.pdf_structure import PdfMetadata
from app.shared.logging.logger import get_logger

logger = get_logger(__name__)


class PypdfMetadataExtractor:
    """Extract PDF metadata using pypdf. Implements IPdfMetadataPort."""

    def extract(
        self,
        content: bytes,
        *,
        filename: str,
        file_size: int | None = None,
    ) -> PdfMetadata:
        size = file_size if file_size is not None else len(content)
        is_pdf = content.startswith(b"%PDF") or filename.lower().endswith(".pdf")

        if not is_pdf:
            return PdfMetadata(
                file_size=size,
                is_pdf=False,
                document_properties={"note": "Not a PDF — metadata extraction skipped"},
            )

        try:
            reader = PdfReader(BytesIO(content), strict=False)
        except Exception as exc:  # noqa: BLE001
            logger.warning("PDF metadata parse failed for %s: %s", filename, exc)
            return PdfMetadata(
                file_size=size,
                is_pdf=True,
                parse_error=str(exc),
            )

        meta = reader.metadata
        document_properties = _metadata_to_dict(meta)

        creation = _meta_get(meta, "creation_date", "/CreationDate")
        modification = _meta_get(meta, "modification_date", "/ModDate")
        producer = _meta_get(meta, "producer", "/Producer")
        creator = _meta_get(meta, "creator", "/Creator")
        title = _meta_get(meta, "title", "/Title")
        author = _meta_get(meta, "author", "/Author")
        subject = _meta_get(meta, "subject", "/Subject")
        keywords = _meta_get(meta, "keywords", "/Keywords")

        pdf_version = None
        try:
            pdf_version = getattr(reader, "pdf_header", None) or None
            if isinstance(pdf_version, str):
                pdf_version = pdf_version.replace("%PDF-", "").strip() or pdf_version
        except Exception:  # noqa: BLE001
            pdf_version = None

        page_count: int | None
        try:
            page_count = len(reader.pages)
        except Exception:  # noqa: BLE001
            page_count = None

        return PdfMetadata(
            creation_date=_stringify(creation),
            modification_date=_stringify(modification),
            producer=_stringify(producer),
            creator=_stringify(creator),
            pdf_version=_stringify(pdf_version),
            page_count=page_count,
            file_size=size,
            title=_stringify(title),
            author=_stringify(author),
            subject=_stringify(subject),
            keywords=_stringify(keywords),
            document_properties=document_properties,
            is_pdf=True,
        )


def _meta_get(meta: Any, *names: str) -> Any:
    if meta is None:
        return None
    for name in names:
        try:
            value = meta.get(name) if hasattr(meta, "get") else None
        except Exception:  # noqa: BLE001
            value = None
        if value not in (None, ""):
            return value
        try:
            value = getattr(meta, name.lstrip("/").lower(), None)
        except Exception:  # noqa: BLE001
            value = None
        if value not in (None, ""):
            return value
    return None


def _metadata_to_dict(meta: Any) -> dict[str, Any]:
    if meta is None:
        return {}
    result: dict[str, Any] = {}
    try:
        items = dict(meta) if meta is not None else {}
    except Exception:  # noqa: BLE001
        items = {}

    for key, value in items.items():
        key_str = str(key)
        if isinstance(value, IndirectObject):
            try:
                value = value.get_object()
            except Exception:  # noqa: BLE001
                value = str(value)
        text = _stringify(value)
        if text is not None:
            result[key_str] = text
    return result


def _stringify(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        try:
            text = value.decode("utf-8", errors="replace").strip()
        except Exception:  # noqa: BLE001
            return None
        return text or None
    text = str(value).strip()
    return text or None
