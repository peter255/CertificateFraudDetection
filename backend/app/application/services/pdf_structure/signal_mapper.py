from __future__ import annotations

from typing import Any

from app.application.dto.pdf_structure import (
    OcrExtractedFields,
    PdfMetadata,
    PdfStructureAnalyzeResponse,
    PdfStructureFinding,
)
from app.application.services.pdf_structure.text_utils import excerpt

_OCR_TEXT_PROFILE_LIMIT = 1_500


def findings_to_signal_payloads(
    findings: list[PdfStructureFinding],
) -> list[dict[str, Any]]:
    """
    Convert PDF structure findings into signal dicts compatible with Engine V2 signals
    and the frontend File Structure bucket.
    """
    signals: list[dict[str, Any]] = []
    for index, finding in enumerate(findings):
        status = "pass" if finding.severity == "info" else finding.status
        if status not in {"pass", "warning", "fail"}:
            status = "pass" if finding.severity == "info" else "warning"
        signals.append(
            {
                "id": f"pdf-structure-{finding.rule_id}-{index}",
                "type": "pdf_structure",
                "check": finding.rule_id,
                "layer": "pdf_structure",
                "stage": "pdf_structure_analysis",
                "detector": "pdf_structure",
                "severity": finding.severity,
                "confidence": finding.confidence,
                "description": f"PDF structure / metadata: {finding.description}",
                "evidence_class": "pdf_structure",
                "field": finding.rule_id,
                "field_label": finding.title,
                "extras": {
                    "rule_id": finding.rule_id,
                    "title": finding.title,
                    "status": status,
                    "evidence": finding.evidence,
                    "recommendation": finding.recommendation,
                },
            }
        )
    return signals


def findings_to_v1_signals(
    findings: list[PdfStructureFinding],
) -> list[dict[str, Any]]:
    """Convert findings into Engine V1 signal shape (category/description/status)."""
    signals: list[dict[str, Any]] = []
    for index, finding in enumerate(findings):
        if finding.severity == "info":
            status = "pass"
        elif finding.status in {"pass", "warning", "fail"}:
            status = finding.status
        else:
            status = "pass"
        signals.append(
            {
                "id": f"pdf-structure-{finding.rule_id}-{index}",
                "category": "PDF Structure",
                "description": finding.description,
                "status": status,
            }
        )
    return signals


def build_structural_profile_update(
    analysis: PdfStructureAnalyzeResponse,
) -> dict[str, Any]:
    """Namespaced structural profile payload for technical details / document info."""
    return {
        "pdf_structure_analysis": {
            "summary": analysis.summary,
            "sources": analysis.sources,
            "duration_ms": analysis.duration_ms,
            "findings_count": len(analysis.findings),
            "ocr_fields": _ocr_public(analysis.ocr_fields),
            "pdf_metadata": _metadata_public(analysis.pdf_metadata),
            "findings": [item.model_dump() for item in analysis.findings],
        }
    }


def _ocr_public(ocr: OcrExtractedFields | None) -> dict[str, Any]:
    if ocr is None:
        return {}
    data = ocr.model_dump(exclude={"raw"})
    text = data.get("detected_text")
    if isinstance(text, str):
        data["detected_text"] = excerpt(text, _OCR_TEXT_PROFILE_LIMIT)
    return data


def _metadata_public(metadata: PdfMetadata | None) -> dict[str, Any]:
    if metadata is None:
        return {}
    return metadata.model_dump()
