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

_RASTER_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".bmp")
_INFO_SKIP_KEYS = frozenset({"exif", "icc_profile", "xmp", "icc_profile_name"})


def _human_file_type(filename: str, *, is_pdf: bool, detected_format: str | None = None) -> str:
    if is_pdf:
        return "PDF"
    if detected_format:
        return detected_format.upper()
    ext = Path(filename).suffix.lower().lstrip(".")
    return ext.upper() if ext else "UNKNOWN"


def _parse_embedded_date(raw: str | None) -> str | None:
    if not raw:
        return None
    parsed = parse_flexible_datetime(raw)
    if parsed is not None:
        return parsed.isoformat()
    return str(raw).strip() or None


def _normalize_info_key(key: str) -> str:
    return key.strip().lower().replace(" ", "_")


def _is_raster_image(content: bytes, lower_name: str) -> bool:
    if lower_name.endswith(_RASTER_EXTENSIONS):
        return True
    if content[:3] == b"\xff\xd8\xff":
        return True
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return True
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return True
    if content[:6] in (b"GIF87a", b"GIF89a"):
        return True
    if content[:2] in (b"MM", b"II"):
        return True
    if content[:2] == b"BM":
        return True
    return False


class PypdfMetadataExtractor:
    """Extract file metadata (PDF + raster images) aligned with metadata.ipynb."""

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

        if is_pdf:
            return self._extract_pdf(
                content,
                filename=filename,
                file_size=size,
                file_type=_human_file_type(filename, is_pdf=True),
                file_modified=file_modified,
            )

        if _is_raster_image(content, lower_name):
            return self._extract_raster_image(
                content,
                filename=filename,
                file_size=size,
                file_type_hint=_human_file_type(filename, is_pdf=False),
                file_modified=file_modified,
            )

        return self._extract_raster_image(
            content,
            filename=filename,
            file_size=size,
            file_type_hint=_human_file_type(filename, is_pdf=False),
            file_modified=file_modified,
            allow_unsupported=True,
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

        creation_iso = _parse_embedded_date(_stringify(creation))
        modification_iso = _parse_embedded_date(_stringify(modification))

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

    def _extract_raster_image(
        self,
        content: bytes,
        *,
        filename: str,
        file_size: int,
        file_type_hint: str,
        file_modified: str | None,
        allow_unsupported: bool = False,
    ) -> PdfMetadata:
        document_properties: dict[str, Any] = {}
        creator: str | None = None
        producer: str | None = None
        editing_producer: str | None = None
        title: str | None = None
        author: str | None = None
        subject: str | None = None
        keywords: str | None = None
        file_type = file_type_hint
        parse_error: str | None = None

        try:
            from PIL import ExifTags, Image
            from PIL.ExifTags import TAGS
        except ImportError:
            return PdfMetadata(
                file_type=file_type_hint,
                file_size=file_size,
                is_pdf=False,
                file_modified=file_modified,
                parse_error="Pillow not installed — image metadata extraction skipped",
                document_properties=document_properties,
            )

        try:
            with Image.open(BytesIO(content)) as img:
                detected_format = _stringify(img.format) or file_type_hint
                file_type = _human_file_type(filename, is_pdf=False, detected_format=detected_format)
                document_properties["format"] = detected_format

                document_properties.update(_parse_png_text_chunks(content))
                document_properties.update(_extract_image_info_chunks(img.info))

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

                creator = (
                    _stringify(document_properties.get("author"))
                    or _stringify(exif.get("Artist"))
                    or _stringify(exif.get("Make"))
                    or _stringify(xmp_creator_tool)
                )
                producer = (
                    _stringify(document_properties.get("software"))
                    or _stringify(document_properties.get("producer"))
                    or _stringify(exif.get("Software"))
                    or _stringify(xmp_creator_tool)
                )
                editing_producer = producer
                title = _stringify(document_properties.get("title")) or _stringify(exif.get("ImageDescription"))
                author = _stringify(document_properties.get("author")) or _stringify(exif.get("Artist"))
                subject = _stringify(document_properties.get("description")) or _stringify(
                    exif.get("UserComment")
                )
                keywords = _stringify(document_properties.get("comment"))

                document_properties.update(
                    {
                        "camera_make": _stringify(exif.get("Make")),
                        "camera_model": _stringify(exif.get("Model")),
                        "image_width": img.width,
                        "image_height": img.height,
                        "color_mode": img.mode,
                        "dpi": _stringify(img.info.get("dpi")),
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
                for tag_name, tag_value in {**exif, **exif_sub}.items():
                    key = f"exif_{_normalize_info_key(str(tag_name))}"
                    if key in document_properties:
                        continue
                    text = _stringify(tag_value)
                    if text:
                        document_properties[key] = text
        except Exception as exc:  # noqa: BLE001
            logger.warning("Image metadata parse failed for %s: %s", filename, exc)
            if allow_unsupported:
                return PdfMetadata(
                    file_type=file_type_hint,
                    file_size=file_size,
                    is_pdf=False,
                    file_modified=file_modified,
                    parse_error=str(exc),
                    document_properties={
                        "note": "Unsupported format — metadata extraction failed",
                    },
                )
            parse_error = str(exc)

        creation_date = (
            document_properties.get("creation_time")
            or document_properties.get("png_date")
            or document_properties.get("date")
            or document_properties.get("exif_datetime_original")
            or document_properties.get("xmp_create_date")
        )
        modification_date = (
            document_properties.get("modification_time")
            or document_properties.get("exif_datetime_modified")
            or document_properties.get("xmp_modify_date")
            or document_properties.get("exif_datetime_digitized")
        )

        if not producer and creator:
            producer = creator

        return PdfMetadata(
            file_type=file_type,
            file_modified=file_modified,
            creation_date=_stringify(creation_date),
            modification_date=_stringify(modification_date),
            creator=creator,
            producer=producer,
            editing_producer=editing_producer,
            title=title,
            author=author,
            subject=subject,
            keywords=keywords,
            file_size=file_size,
            document_properties=document_properties,
            is_pdf=False,
            parse_error=parse_error,
        )


def _parse_png_text_chunks(content: bytes) -> dict[str, Any]:
    """Read PNG tEXt / iTXt metadata chunks (Software, Creation Time, etc.)."""
    if not content.startswith(b"\x89PNG\r\n\x1a\n"):
        return {}

    props: dict[str, Any] = {}
    offset = 8
    while offset + 12 <= len(content):
        length = int.from_bytes(content[offset : offset + 4], "big")
        chunk_type = content[offset + 4 : offset + 8]
        data_start = offset + 8
        data_end = data_start + length
        if data_end > len(content):
            break
        chunk_data = content[data_start:data_end]

        if chunk_type == b"tEXt" and b"\x00" in chunk_data:
            key_raw, value_raw = chunk_data.split(b"\x00", 1)
            key = _normalize_info_key(key_raw.decode("latin-1", errors="replace"))
            value = _stringify(value_raw.decode("latin-1", errors="replace"))
            if key and value:
                props[key] = value
        elif chunk_type == b"iTXt" and len(chunk_data) >= 2:
            try:
                null_idx = chunk_data.index(0)
                key = _normalize_info_key(chunk_data[:null_idx].decode("utf-8", errors="replace"))
                tail = chunk_data[null_idx + 1 :]
                if len(tail) >= 2:
                    compression_flag = tail[0]
                    compression_method = tail[1]
                    tail = tail[2:]
                    if b"\x00" in tail:
                        _, text_raw = tail.split(b"\x00", 1)
                        if compression_flag == 0:
                            value = _stringify(text_raw.decode("utf-8", errors="replace"))
                        elif compression_method == 0:
                            import zlib

                            value = _stringify(
                                zlib.decompress(text_raw).decode("utf-8", errors="replace")
                            )
                        else:
                            value = None
                        if key and value:
                            props[key] = value
            except Exception:  # noqa: BLE001
                pass

        offset = data_end + 4
    return props


def _extract_image_info_chunks(info: dict[str, Any]) -> dict[str, Any]:
    props: dict[str, Any] = {}
    for key, value in (info or {}).items():
        if _normalize_info_key(str(key)) in _INFO_SKIP_KEYS:
            continue
        if isinstance(value, (bytes, bytearray)):
            continue
        text = _stringify(value)
        if text is None:
            continue
        props[_normalize_info_key(str(key))] = text
    return props


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
    if isinstance(value, tuple):
        parts = [_stringify(item) for item in value]
        cleaned = [part for part in parts if part]
        return ", ".join(cleaned) if cleaned else None
    text = str(value).strip()
    return text or None
