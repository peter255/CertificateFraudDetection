from __future__ import annotations

from io import BytesIO

from PIL import Image

from app.infrastructure.pdf.metadata_extractor import PypdfMetadataExtractor


def test_extract_png_image_dimensions() -> None:
    image = Image.new("RGBA", (640, 480), color=(10, 20, 30, 255))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    content = buffer.getvalue()

    metadata = PypdfMetadataExtractor().extract(
        content,
        filename="certificate.png",
        file_size=len(content),
    )

    assert metadata.file_type == "PNG"
    assert metadata.is_pdf is False
    assert metadata.document_properties.get("image_width") == 640
    assert metadata.document_properties.get("image_height") == 480
    assert metadata.document_properties.get("color_mode") == "RGBA"
    assert metadata.document_properties.get("format") == "PNG"
    assert "Unsupported format" not in str(metadata.document_properties.get("note", ""))
