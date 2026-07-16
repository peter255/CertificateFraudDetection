from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field

from app.application.dto.pdf_structure import PdfStructureFinding
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.metadata_presence import (
    metadata_core_embedded_present,
    resolve_embedded_creation_date,
    resolve_embedded_creator,
    resolve_embedded_producer,
)
from app.application.services.pdf_structure.rules.producer import match_suspicious_producer

# Semantic tags used by contextual patterns (stable, explainable labels).
TAG_SUSPICIOUS_PRODUCER = "SUSPICIOUS_PRODUCER"
TAG_UNKNOWN_PRODUCER = "UNKNOWN_PRODUCER"
TAG_MISSING_PRODUCER = "MISSING_PRODUCER"
TAG_MISSING_CREATOR = "MISSING_CREATOR"
TAG_MISSING_CREATION_DATE = "MISSING_CREATION_DATE"
TAG_EMPTY_METADATA = "EMPTY_METADATA"
TAG_METADATA_INCONSISTENCY = "METADATA_INCONSISTENCY"
TAG_MODIFICATION_BEFORE_CREATION = "MODIFICATION_BEFORE_CREATION"
TAG_MODIFICATION_AFTER_AWARD = "MODIFICATION_AFTER_AWARD"
TAG_AWARD_AFTER_MODIFICATION = "AWARD_AFTER_MODIFICATION"
TAG_AWARD_BEFORE_CREATION = "AWARD_BEFORE_CREATION"
TAG_EXPIRATION_BEFORE_AWARD = "EXPIRATION_BEFORE_AWARD"
TAG_INVALID_TIMESTAMPS = "INVALID_TIMESTAMPS"
TAG_IMPOSSIBLE_CHRONOLOGY = "IMPOSSIBLE_CHRONOLOGY"
TAG_MISSING_CERTIFICATE_ID = "MISSING_CERTIFICATE_ID"
TAG_MISSING_HOLDER_NAME = "MISSING_HOLDER_NAME"
TAG_MISSING_ISSUER = "MISSING_ISSUER"
TAG_MISSING_AWARD_OR_ISSUE_DATE = "MISSING_AWARD_OR_ISSUE_DATE"
TAG_OCR_MISSING_IMPORTANT_FIELDS = "OCR_MISSING_IMPORTANT_FIELDS"
TAG_OCR_EMPTY = "OCR_EMPTY"

_RULE_TO_TAGS: dict[str, frozenset[str]] = {
    "PDF_SUSPICIOUS_PRODUCER": frozenset({TAG_SUSPICIOUS_PRODUCER}),
    "PDF_UNKNOWN_PRODUCER": frozenset({TAG_UNKNOWN_PRODUCER}),
    "PDF_MISSING_PRODUCER": frozenset({TAG_MISSING_PRODUCER}),
    "PDF_MISSING_CREATOR": frozenset({TAG_MISSING_CREATOR}),
    "PDF_MISSING_CREATION_DATE": frozenset({TAG_MISSING_CREATION_DATE}),
    "PDF_EMPTY_METADATA": frozenset({TAG_EMPTY_METADATA}),
    "PDF_METADATA_INCONSISTENCY": frozenset({TAG_METADATA_INCONSISTENCY}),
    "PDF_MOD_BEFORE_CREATION": frozenset({TAG_MODIFICATION_BEFORE_CREATION}),
    "PDF_AWARD_AFTER_MODIFICATION": frozenset({TAG_AWARD_AFTER_MODIFICATION}),
    "PDF_AWARD_BEFORE_CREATION": frozenset({TAG_AWARD_BEFORE_CREATION}),
    "PDF_EXPIRATION_BEFORE_AWARD": frozenset({TAG_EXPIRATION_BEFORE_AWARD}),
    "PDF_INVALID_TIMESTAMPS": frozenset({TAG_INVALID_TIMESTAMPS}),
    "PDF_IMPOSSIBLE_CHRONOLOGY": frozenset({TAG_IMPOSSIBLE_CHRONOLOGY}),
    "OCR_MISSING_IMPORTANT_FIELDS": frozenset({TAG_OCR_MISSING_IMPORTANT_FIELDS}),
}

_MISSING_FIELD_TO_TAG: dict[str, str] = {
    "Certificate ID": TAG_MISSING_CERTIFICATE_ID,
    "Holder Name": TAG_MISSING_HOLDER_NAME,
    "Issuer": TAG_MISSING_ISSUER,
    "Award Date": TAG_MISSING_AWARD_OR_ISSUE_DATE,
    "Issue Date": TAG_MISSING_AWARD_OR_ISSUE_DATE,
    "Award/Issue Date": TAG_MISSING_AWARD_OR_ISSUE_DATE,
}


@dataclass(frozen=True)
class IndicatorIndex:
    """
    Deterministic index of forensic indicators.

    Built from atomic rule findings plus soft tags derived from OCR/metadata context.
    Soft tags allow combinations that are weak alone but meaningful together
    (e.g. modification-after-award is often benign unless paired with a design-tool producer).
    """

    tags: frozenset[str]
    findings_by_rule: dict[str, PdfStructureFinding] = field(default_factory=dict)
    tag_sources: dict[str, list[str]] = field(default_factory=dict)

    def has(self, tag: str) -> bool:
        return tag in self.tags

    def has_all(self, required: frozenset[str] | set[str]) -> bool:
        return required.issubset(self.tags)

    def has_any(self, options: frozenset[str] | set[str]) -> bool:
        return bool(self.tags.intersection(options))

    def count(self, options: frozenset[str] | set[str]) -> int:
        return len(self.tags.intersection(options))

    def contributing_findings(self, tags: frozenset[str] | set[str]) -> list[PdfStructureFinding]:
        rule_ids: set[str] = set()
        for tag in tags:
            for source in self.tag_sources.get(tag, []):
                if source.startswith("rule:"):
                    rule_ids.add(source.removeprefix("rule:"))
        return [
            self.findings_by_rule[rule_id]
            for rule_id in sorted(rule_ids)
            if rule_id in self.findings_by_rule
        ]


def build_indicator_index(
    *,
    context: PdfStructureContext,
    atomic_findings: list[PdfStructureFinding],
) -> IndicatorIndex:
    tags: set[str] = set()
    tag_sources: dict[str, list[str]] = {}
    findings_by_rule = {item.rule_id: item for item in atomic_findings}

    def add(tag: str, source: str) -> None:
        tags.add(tag)
        tag_sources.setdefault(tag, [])
        if source not in tag_sources[tag]:
            tag_sources[tag].append(source)

    for finding in atomic_findings:
        for tag in _RULE_TO_TAGS.get(finding.rule_id, ()):
            add(tag, f"rule:{finding.rule_id}")

        if finding.rule_id == "OCR_MISSING_IMPORTANT_FIELDS":
            missing = finding.evidence.get("missing_fields") or []
            if isinstance(missing, list):
                for label in missing:
                    mapped = _MISSING_FIELD_TO_TAG.get(str(label))
                    if mapped:
                        add(mapped, f"rule:{finding.rule_id}")
            if finding.severity == "critical":
                add(TAG_OCR_EMPTY, f"rule:{finding.rule_id}")

    _derive_soft_tags(context, add)

    filtered = _filter_contradictory_metadata_tags(context, tags)

    return IndicatorIndex(
        tags=frozenset(filtered),
        findings_by_rule=findings_by_rule,
        tag_sources=tag_sources,
    )


def _filter_contradictory_metadata_tags(
    context: PdfStructureContext,
    tags: set[str],
) -> set[str]:
    """Drop metadata-gap tags when embedded file metadata proves the field exists."""
    filtered = set(tags)
    if resolve_embedded_creation_date(context.metadata):
        filtered.discard(TAG_MISSING_CREATION_DATE)
    if resolve_embedded_producer(context.metadata):
        filtered.discard(TAG_MISSING_PRODUCER)
    if resolve_embedded_creator(context.metadata):
        filtered.discard(TAG_MISSING_CREATOR)
    if metadata_core_embedded_present(context.metadata):
        filtered.discard(TAG_EMPTY_METADATA)
    return filtered


def _derive_soft_tags(
    context: PdfStructureContext,
    add: Callable[[str, str], None],
) -> None:
    """Context-derived tags that may not warrant a standalone atomic finding."""
    dates = context.parsed_dates()
    award = dates["award_date"] or dates["issue_date"]
    modified = dates["modification_date"]
    created = dates["creation_date"]
    expiration = dates["expiration_date"]

    if award is not None and modified is not None and modified > award:
        add(TAG_MODIFICATION_AFTER_AWARD, "context:modification_after_award")
    if award is not None and modified is not None and award > modified:
        add(TAG_AWARD_AFTER_MODIFICATION, "context:award_after_modification")
    if award is not None and created is not None and award < created:
        add(TAG_AWARD_BEFORE_CREATION, "context:award_before_creation")
    if created is not None and modified is not None and modified < created:
        add(TAG_MODIFICATION_BEFORE_CREATION, "context:modification_before_creation")
    if award is not None and expiration is not None and expiration < award:
        add(TAG_EXPIRATION_BEFORE_AWARD, "context:expiration_before_award")

    producer_hit = match_suspicious_producer(context.metadata.producer)
    creator_hit = match_suspicious_producer(context.metadata.creator)
    if producer_hit or creator_hit:
        add(TAG_SUSPICIOUS_PRODUCER, "context:suspicious_producer")

    if context.metadata.is_pdf and not resolve_embedded_producer(context.metadata):
        add(TAG_MISSING_PRODUCER, "context:missing_producer")
    creator = resolve_embedded_creator(context.metadata)
    if context.metadata.is_pdf and not creator:
        add(TAG_MISSING_CREATOR, "context:missing_creator")
    if context.metadata.is_pdf and not resolve_embedded_creation_date(context.metadata):
        add(TAG_MISSING_CREATION_DATE, "context:missing_creation_date")

    ocr_usable = bool(
        context.extras.get("ocr_attempted")
        or (context.ocr.detected_text and context.ocr.detected_text.strip())
        or context.ocr.key_value_pairs
        or context.ocr.holder_name
        or context.ocr.issuer
    )
    if ocr_usable:
        if not (context.ocr.certificate_id or "").strip():
            add(TAG_MISSING_CERTIFICATE_ID, "context:missing_certificate_id")
        if not (context.ocr.holder_name or "").strip():
            add(TAG_MISSING_HOLDER_NAME, "context:missing_holder_name")
        if not (context.ocr.issuer or "").strip():
            add(TAG_MISSING_ISSUER, "context:missing_issuer")
        if not (context.ocr.award_date or "").strip() and not (context.ocr.issue_date or "").strip():
            add(TAG_MISSING_AWARD_OR_ISSUE_DATE, "context:missing_award_or_issue_date")
