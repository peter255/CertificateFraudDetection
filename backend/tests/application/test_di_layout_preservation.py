"""Tests that Azure Document Intelligence layout geometry is preserved in ocr_fields.raw."""

from __future__ import annotations

from app.infrastructure.azure_document_intelligence.field_mapper import (
    map_document_intelligence_result,
)


def _sample_analyze_result() -> dict:
    return {
        "apiVersion": "2024-11-30",
        "modelId": "prebuilt-layout",
        "content": "Holder Name: Jane Doe\nIssuer: Contoso Academy\nIssue Date: 2024-06-15",
        "pages": [
            {
                "pageNumber": 1,
                "width": 8.5,
                "height": 11.0,
                "unit": "inch",
                "words": [
                    {
                        "content": "Jane",
                        "polygon": [1.0, 2.0, 1.5, 2.0, 1.5, 2.3, 1.0, 2.3],
                        "confidence": 0.99,
                        "span": {"offset": 13, "length": 4},
                    },
                    {
                        "content": "Doe",
                        "polygon": [1.6, 2.0, 2.1, 2.0, 2.1, 2.3, 1.6, 2.3],
                        "confidence": 0.98,
                        "span": {"offset": 18, "length": 3},
                    },
                ],
                "lines": [
                    {
                        "content": "Holder Name: Jane Doe",
                        "polygon": [0.5, 2.0, 2.2, 2.0, 2.2, 2.3, 0.5, 2.3],
                        "spans": [{"offset": 0, "length": 21}],
                    }
                ],
            }
        ],
        "paragraphs": [
            {
                "content": "Holder Name: Jane Doe",
                "boundingRegions": [
                    {"pageNumber": 1, "polygon": [0.5, 2.0, 2.2, 2.0, 2.2, 2.3, 0.5, 2.3]}
                ],
                "spans": [{"offset": 0, "length": 21}],
            }
        ],
        "keyValuePairs": [
            {
                "key": {"content": "Holder Name", "boundingRegions": [], "spans": []},
                "value": {
                    "content": "Jane Doe",
                    "boundingRegions": [
                        {"pageNumber": 1, "polygon": [1.0, 2.0, 2.1, 2.0, 2.1, 2.3, 1.0, 2.3]}
                    ],
                    "spans": [{"offset": 13, "length": 8}],
                },
            },
            {
                "key": {"content": "Issuer", "boundingRegions": [], "spans": []},
                "value": {"content": "Contoso Academy", "boundingRegions": [], "spans": []},
            },
            {
                "key": {"content": "Issue Date", "boundingRegions": [], "spans": []},
                "value": {"content": "2024-06-15", "boundingRegions": [], "spans": []},
            },
        ],
    }


def test_mapper_preserves_full_analyze_result_layout() -> None:
    analyze_result = _sample_analyze_result()
    mapped = map_document_intelligence_result(analyze_result)

    assert mapped.holder_name == "Jane Doe"
    assert mapped.issuer == "Contoso Academy"
    assert mapped.raw.get("api") == "azure_document_intelligence"
    assert mapped.raw.get("page_count") == 1

    layout = mapped.raw.get("analyzeResult")
    assert isinstance(layout, dict)
    assert layout["pages"][0]["words"][0]["polygon"] == [1.0, 2.0, 1.5, 2.0, 1.5, 2.3, 1.0, 2.3]
    assert layout["pages"][0]["lines"][0]["spans"] == [{"offset": 0, "length": 21}]
    assert layout["paragraphs"][0]["boundingRegions"][0]["pageNumber"] == 1
    assert layout["keyValuePairs"][0]["value"]["boundingRegions"][0]["polygon"] == [
        1.0,
        2.0,
        2.1,
        2.0,
        2.1,
        2.3,
        1.0,
        2.3,
    ]


def test_structural_profile_includes_raw_layout() -> None:
    from datetime import datetime, timezone

    from app.application.dto.pdf_structure import PdfStructureAnalyzeResponse
    from app.application.services.pdf_structure.signal_mapper import (
        build_structural_profile_update,
    )

    mapped = map_document_intelligence_result(_sample_analyze_result())
    profile = build_structural_profile_update(
        PdfStructureAnalyzeResponse(
            status="completed",
            findings=[],
            ocr_fields=mapped,
            pdf_metadata=None,
            summary="ok",
            analyzed_at=datetime.now(timezone.utc),
            duration_ms=1,
            sources={"ocr": True},
        )
    )
    ocr = profile["pdf_structure_analysis"]["ocr_fields"]
    assert "raw" in ocr
    assert ocr["raw"]["analyzeResult"]["pages"][0]["words"][0]["content"] == "Jane"
