from __future__ import annotations

from app.application.dto.pdf_structure import OcrExtractedFields, PdfMetadata
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.contextual.indicators import (
    TAG_MISSING_CREATION_DATE,
    TAG_MISSING_PRODUCER,
    build_indicator_index,
)
from app.application.services.pdf_structure.contextual.reasoner import ContextualReasoner
from app.application.services.pdf_structure.rules.registry import build_default_rule_registry


def _context(
    *,
    producer: str | None = "Adobe Photoshop 2024",
    award_date: str | None = "2020-06-01",
    modification_date: str | None = "D:20240601120000Z",
    creation_date: str | None = "D:20240101120000Z",
    certificate_id: str | None = None,
    holder_name: str | None = "Ada Lovelace",
    issuer: str | None = "MIT",
    ocr_attempted: bool = True,
) -> PdfStructureContext:
    return PdfStructureContext(
        ocr=OcrExtractedFields(
            holder_name=holder_name,
            issuer=issuer,
            award_date=award_date,
            certificate_id=certificate_id,
            detected_text="Certificate text",
        ),
        metadata=PdfMetadata(
            is_pdf=True,
            producer=producer,
            creator="Canva",
            creation_date=creation_date,
            modification_date=modification_date,
            page_count=1,
        ),
        extras={"ocr_attempted": ocr_attempted, "ocr_configured": ocr_attempted},
    )


def test_photoshop_mod_after_award_missing_id_produces_contextual_finding() -> None:
    context = _context(certificate_id=None)
    atomic = build_default_rule_registry().evaluate_all(context)
    composites = ContextualReasoner().evaluate(context=context, atomic_findings=atomic)

    matched = [item for item in composites if item.rule_id == "CTX_DESIGN_TOOL_EDIT_AFTER_AWARD_MISSING_ID"]
    assert len(matched) == 1

    finding = matched[0]
    assert finding.severity == "critical"
    assert finding.status == "fail"
    assert finding.evidence["reasoning_type"] == "contextual_combination"
    assert "SUSPICIOUS_PRODUCER" in finding.evidence["matched_tags"]
    assert "MODIFICATION_AFTER_AWARD" in finding.evidence["matched_tags"]
    assert "MISSING_CERTIFICATE_ID" in finding.evidence["matched_tags"]
    assert "rationale" in finding.evidence
    assert "context_snapshot" in finding.evidence
    # Must not invent a risk score field.
    assert "risk_score" not in finding.evidence
    assert "score" not in finding.evidence


def test_individual_indicator_alone_does_not_fire_strong_composite() -> None:
    # Suspicious producer only — no post-award mod, ID present.
    context = _context(
        award_date="2024-06-01",
        modification_date="D:20200101120000Z",  # modification before award
        certificate_id="CERT-1",
    )
    atomic = build_default_rule_registry().evaluate_all(context)
    composites = ContextualReasoner().evaluate(context=context, atomic_findings=atomic)

    assert not any(
        item.rule_id == "CTX_DESIGN_TOOL_EDIT_AFTER_AWARD_MISSING_ID" for item in composites
    )


def test_contextual_finding_is_explainable_with_tag_sources() -> None:
    context = _context(certificate_id=None)
    atomic = build_default_rule_registry().evaluate_all(context)
    composites = ContextualReasoner().evaluate(context=context, atomic_findings=atomic)
    finding = next(
        item
        for item in composites
        if item.rule_id == "CTX_DESIGN_TOOL_EDIT_AFTER_AWARD_MISSING_ID"
    )

    sources = finding.evidence["tag_sources"]
    assert any(sources.get("SUSPICIOUS_PRODUCER"))
    assert any("context:modification_after_award" in s for s in sources.get("MODIFICATION_AFTER_AWARD", []))
    assert any(
        "missing_certificate_id" in s for s in sources.get("MISSING_CERTIFICATE_ID", [])
    )


def test_chronology_cluster_requires_multiple_date_tags() -> None:
    # Impossible: mod before creation AND expiration before award.
    context = PdfStructureContext(
        ocr=OcrExtractedFields(
            award_date="2020-06-01",
            expiration_date="2019-01-01",
            certificate_id="X",
            holder_name="Ada",
            issuer="MIT",
            detected_text="text",
        ),
        metadata=PdfMetadata(
            is_pdf=True,
            producer="Adobe Acrobat",
            creation_date="D:20240101120000Z",
            modification_date="D:20230101120000Z",  # before creation
        ),
        extras={"ocr_attempted": True},
    )
    atomic = build_default_rule_registry().evaluate_all(context)
    composites = ContextualReasoner().evaluate(context=context, atomic_findings=atomic)

    assert any(item.rule_id == "CTX_CHRONOLOGY_CLUSTER" for item in composites)


def test_adobe_scan_metadata_does_not_emit_missing_creation_tags() -> None:
    context = PdfStructureContext(
        ocr=OcrExtractedFields(
            certificate_id=None,
            holder_name=None,
            issuer=None,
            detected_text="Certificate text",
        ),
        metadata=PdfMetadata(
            is_pdf=True,
            producer="Adobe Scan for iOS 26.03.19",
            creator="Adobe Scan for iOS 26.03.19",
            creation_date="2026-07-08T08:25:22.000Z",
            modification_date="2026-07-08T08:25:22.000Z",
            page_count=3,
        ),
        extras={"ocr_attempted": True, "ocr_configured": True},
    )
    atomic = build_default_rule_registry().evaluate_all(context)
    index = build_indicator_index(context=context, atomic_findings=atomic)
    assert TAG_MISSING_CREATION_DATE not in index.tags
    assert TAG_MISSING_PRODUCER not in index.tags

    composites = ContextualReasoner().evaluate(context=context, atomic_findings=atomic)
    stripped = [item for item in composites if item.rule_id == "CTX_STRIPPED_METADATA_AND_IDENTITY"]
    assert not stripped
    if stripped:
        assert "MISSING_CREATION_DATE" not in stripped[0].evidence["matched_tags"]
