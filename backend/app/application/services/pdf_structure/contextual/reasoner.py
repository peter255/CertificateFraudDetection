from __future__ import annotations

from typing import Any

from app.application.dto.pdf_structure import PdfStructureFinding
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.contextual.indicators import (
    IndicatorIndex,
    build_indicator_index,
)
from app.application.services.pdf_structure.contextual.patterns import (
    ContextualPattern,
    build_default_contextual_patterns,
)
from app.application.services.pdf_structure.rules.base import finding


class ContextualReasoner:
    """
    Deterministic contextual forensic reasoner.

    Combines atomic rule findings and soft context tags into stronger, explainable
    composite findings. Does not compute a risk score.
    """

    def __init__(self, patterns: tuple[ContextualPattern, ...] | None = None) -> None:
        self._patterns = patterns or build_default_contextual_patterns()

    @property
    def patterns(self) -> tuple[ContextualPattern, ...]:
        return self._patterns

    def evaluate(
        self,
        *,
        context: PdfStructureContext,
        atomic_findings: list[PdfStructureFinding],
    ) -> list[PdfStructureFinding]:
        index = build_indicator_index(context=context, atomic_findings=atomic_findings)
        composites: list[PdfStructureFinding] = []

        for pattern in self._patterns:
            if not pattern.matches(index):
                continue
            composites.append(self._to_finding(pattern, index, context))

        return composites

    def _to_finding(
        self,
        pattern: ContextualPattern,
        index: IndicatorIndex,
        context: PdfStructureContext,
    ) -> PdfStructureFinding:
        matched_tags = pattern.matched_tags(index)
        contributors = index.contributing_findings(set(matched_tags))
        tag_source_map = {
            tag: list(index.tag_sources.get(tag, []))
            for tag in matched_tags
        }

        description = (
            f"{pattern.rationale} Matched indicators: {', '.join(matched_tags)}."
        )

        evidence: dict[str, Any] = {
            "reasoning_type": "contextual_combination",
            "pattern_id": pattern.pattern_id,
            "rationale": pattern.rationale,
            "matched_tags": matched_tags,
            "tag_sources": tag_source_map,
            "contributing_findings": [
                {
                    "rule_id": item.rule_id,
                    "title": item.title,
                    "severity": item.severity,
                    "status": item.status,
                }
                for item in contributors
            ],
            "context_snapshot": _context_snapshot(context),
            # Explicitly not a risk score — confidence is only in this combination match.
            "combination_strength": _combination_strength(pattern, matched_tags),
        }

        return finding(
            rule_id=pattern.pattern_id,
            severity=pattern.severity,
            status=pattern.status,
            title=pattern.title,
            description=description,
            evidence=evidence,
            recommendation=pattern.recommendation,
            confidence=pattern.confidence,
        )


def _combination_strength(pattern: ContextualPattern, matched_tags: list[str]) -> str:
    """Human-readable strength label — not a numeric risk score."""
    count = len(matched_tags)
    if pattern.severity == "critical" and count >= 3:
        return "high"
    if pattern.severity == "critical" or count >= 3:
        return "elevated"
    return "moderate"


def _context_snapshot(context: PdfStructureContext) -> dict[str, Any]:
    return {
        "producer": context.metadata.producer,
        "creator": context.metadata.creator,
        "creation_date": context.metadata.creation_date,
        "modification_date": context.metadata.modification_date,
        "award_date": context.ocr.award_date,
        "issue_date": context.ocr.issue_date,
        "expiration_date": context.ocr.expiration_date,
        "certificate_id": context.ocr.certificate_id,
        "holder_name": context.ocr.holder_name,
        "issuer": context.ocr.issuer,
    }
