from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Any

from pypdf import PdfReader
from pypdf.generic import IndirectObject

from app.application.dto.pdf_structure import PdfMetadata
from app.application.services.pdf_structure.date_utils import parse_flexible_datetime
from app.shared.logging.logger import get_logger

logger = get_logger(__name__)


def _human_file_type(filename: str, *, is_pdf: bool, is_jpeg: bool) -> str:
    if is_pdf:
        return "PDF"
    if is_jpeg:
        return "JPEG"
    ext = Path(filename).suffix.lower().lstrip(".")
    return ext.upper() if ext else "UNKNOWN"


def _parse_pdf_embedded_date(raw: str | None) -> str | None:
    if not raw:
        return None
    parsed = parse_flexible_datetime(raw)
    if parsed is not None:
        return parsed.isoformat()
    return str(raw).strip() or None


class PypdfMetadataExtractor:
    """Extract file metadata (PDF + JPEG) aligned with metadata.ipynb."""

    def extract(
        self,
        content: bytes,
        *,
        filename: str,
        file_size: int | None = None,
        file_modified: str | None = None,
    ) -> PdfMetadata:
        size = file_size if file_size is not None else len(content)
        lower_name = filename.lower()
        is_pdf = content.startswith(b"%PDF") or lower_name.endswith(".pdf")
        is_jpeg = lower_name.endswith((".jpg", ".jpeg")) or content[:3] == b"\xff\xd8\xff"
        file_type = _human_file_type(filename, is_pdf=is_pdf, is_jpeg=is_jpeg)

        if is_jpeg and not is_pdf:
            return self._extract_jpeg(
                content,
                filename=filename,
                file_size=size,
                file_type=file_type,
                file_modified=file_modified,
            )

        if not is_pdf:
            return PdfMetadata(
                file_type=file_type,
                file_size=size,
                is_pdf=False,
                file_modified=file_modified,
                document_properties={"note": "Unsupported format — PDF/JPEG metadata extraction skipped"},
            )

        return self._extract_pdf(
            content,
            filename=filename,
            file_size=size,
            file_type=file_type,
            file_modified=file_modified,
        )

    def _extract_pdf(
        self,
        content: bytes,
        *,
        filename: str,
        file_size: int,
        file_type: str,
        file_modified: str | None,
    ) -> PdfMetadata:
        try:
            reader = PdfReader(BytesIO(content), strict=False)
        except Exception as exc:  # noqa: BLE001
            logger.warning("PDF metadata parse failed for %s: %s", filename, exc)
            return PdfMetadata(
                file_type=file_type,
                file_size=file_size,
                is_pdf=True,
                file_modified=file_modified,
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

        creation_iso = _parse_pdf_embedded_date(_stringify(creation))
        modification_iso = _parse_pdf_embedded_date(_stringify(modification))

        editing_producer: str | None = None
        producer_text = _stringify(producer)
        if modification_iso and producer_text:
            editing_producer = producer_text

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

        document_properties.update(
            {
                "document_creation_date": creation_iso,
                "document_modification_date": modification_iso,
                "title": _stringify(title),
                "author": _stringify(author),
                "subject": _stringify(subject),
                "keywords": _stringify(keywords),
                "pdf_version": _stringify(pdf_version),
            }
        )

        return PdfMetadata(
            file_type=file_type,
            creation_date=creation_iso or _stringify(creation),
            modification_date=modification_iso or _stringify(modification),
            file_modified=file_modified,
            producer=producer_text,
            creator=_stringify(creator),
            editing_producer=editing_producer,
            pdf_version=_stringify(pdf_version),
            page_count=page_count,
            file_size=file_size,
            title=_stringify(title),
            author=_stringify(author),
            subject=_stringify(subject),
            keywords=_stringify(keywords),
            document_properties=document_properties,
            is_pdf=True,
        )

    def _extract_jpeg(
        self,
        content: bytes,
        *,
        filename: str,
        file_size: int,
        file_type: str,
        file_modified: str | None,
    ) -> PdfMetadata:
        document_properties: dict[str, Any] = {"format": "JPEG"}
        creator: str | None = None
        producer: str | None = None
        editing_producer: str | None = None
        parse_error: str | None = None

        try:
            from PIL import ExifTags, Image
            from PIL.ExifTags import TAGS
        except ImportError:
            return PdfMetadata(
                file_type=file_type,
                file_size=file_size,
                is_pdf=False,
                file_modified=file_modified,
                parse_error="Pillow not installed — JPEG EXIF/XMP extraction skipped",
                document_properties=document_properties,
            )

        try:
            with Image.open(BytesIO(content)) as img:
                exif_ifd0_raw = img.getexif()
                exif = {TAGS.get(tag_id, tag_id): value for tag_id, value in exif_ifd0_raw.items()}

                try:
                    exif_sub_raw = exif_ifd0_raw.get_ifd(ExifTags.IFD.Exif)
                    exif_sub = {
                        TAGS.get(tag_id, tag_id): value for tag_id, value in exif_sub_raw.items()
                    }
                except Exception:  # noqa: BLE001
                    exif_sub = {}

                try:
                    xmp = img.getxmp() or {}
                except Exception:  # noqa: BLE001
                    xmp = {}

                xmp_desc = (
                    xmp.get("xmpmeta", {}).get("RDF", {}).get("Description", {})
                    if isinstance(xmp, dict)
                    else {}
                )
                if isinstance(xmp_desc, list):
                    xmp_desc = xmp_desc[0] if xmp_desc else {}

                xmp_creator_tool = xmp_desc.get("CreatorTool") if isinstance(xmp_desc, dict) else None

                creator = _stringify(exif.get("Make")) or _stringify(exif.get("Artist")) or _stringify(
                    xmp_creator_tool
                )
                producer = _stringify(exif.get("Software")) or _stringify(xmp_creator_tool)
                editing_producer = _stringify(exif.get("Software")) or _stringify(xmp_creator_tool)

                document_properties.update(
                    {
                        "camera_model": _stringify(exif.get("Model")),
                        "image_width": img.width,
                        "image_height": img.height,
                        "color_mode": img.mode,
                        "exif_datetime_original": _stringify(
                            exif_sub.get("DateTimeOriginal") or exif.get("DateTimeOriginal")
                        ),
                        "exif_datetime_digitized": _stringify(exif_sub.get("DateTimeDigitized")),
                        "exif_datetime_modified": _stringify(exif.get("DateTime")),
                        "editing_software_xmp": _stringify(xmp_creator_tool),
                        "xmp_create_date": _stringify(xmp_desc.get("CreateDate"))
                        if isinstance(xmp_desc, dict)
                        else None,
                        "xmp_modify_date": _stringify(xmp_desc.get("ModifyDate"))
                        if isinstance(xmp_desc, dict)
                        else None,
                        "has_any_exif": bool(exif) or bool(exif_sub),
                        "has_xmp": bool(xmp_desc),
                    }
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("JPEG metadata parse failed for %s: %s", filename, exc)
            parse_error = str(exc)

        return PdfMetadata(
            file_type=file_type,
            file_modified=file_modified,
            creator=creator,
            producer=producer,
            editing_producer=editing_producer,
            file_size=file_size,
            document_properties=document_properties,
            is_pdf=False,
            parse_error=parse_error,
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
