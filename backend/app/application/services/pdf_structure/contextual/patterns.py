from __future__ import annotations

from dataclasses import dataclass

from app.application.services.pdf_structure.contextual.indicators import (
    TAG_AWARD_AFTER_MODIFICATION,
    TAG_AWARD_BEFORE_CREATION,
    TAG_EMPTY_METADATA,
    TAG_EXPIRATION_BEFORE_AWARD,
    TAG_IMPOSSIBLE_CHRONOLOGY,
    TAG_INVALID_TIMESTAMPS,
    TAG_MISSING_CERTIFICATE_ID,
    TAG_MISSING_CREATION_DATE,
    TAG_MISSING_HOLDER_NAME,
    TAG_MISSING_ISSUER,
    TAG_MISSING_PRODUCER,
    TAG_MODIFICATION_AFTER_AWARD,
    TAG_MODIFICATION_BEFORE_CREATION,
    TAG_OCR_EMPTY,
    TAG_OCR_MISSING_IMPORTANT_FIELDS,
    TAG_SUSPICIOUS_PRODUCER,
    TAG_UNKNOWN_PRODUCER,
    IndicatorIndex,
)


@dataclass(frozen=True)
class ContextualPattern:
    """
    Declarative, deterministic combination pattern.

    A pattern fires when:
    - all `required_tags` are present
    - each group in `require_any_groups` has at least one present tag
    - at least `min_supporting` tags from `supporting_tags` are present (if min_supporting > 0)
    """

    pattern_id: str
    title: str
    rationale: str
    required_tags: frozenset[str] = frozenset()
    require_any_groups: tuple[frozenset[str], ...] = ()
    supporting_tags: frozenset[str] = frozenset()
    min_supporting: int = 0
    severity: str = "warning"
    status: str = "warning"
    confidence: float = 0.85
    recommendation: str = (
        "Review the combined indicators together; the combination is more significant "
        "than any single signal in isolation."
    )

    def matches(self, index: IndicatorIndex) -> bool:
        if not index.has_all(self.required_tags):
            return False
        for group in self.require_any_groups:
            if not index.has_any(group):
                return False
        if self.min_supporting > 0 and index.count(self.supporting_tags) < self.min_supporting:
            return False
        # Avoid matching a pattern that requires nothing.
        return bool(
            self.required_tags
            or self.require_any_groups
            or (self.min_supporting > 0 and self.supporting_tags)
        )

    def matched_tags(self, index: IndicatorIndex) -> list[str]:
        matched: set[str] = set(self.required_tags)
        for group in self.require_any_groups:
            matched.update(index.tags.intersection(group))
        if self.supporting_tags:
            matched.update(index.tags.intersection(self.supporting_tags))
        return sorted(matched)


def build_default_contextual_patterns() -> tuple[ContextualPattern, ...]:
    """
    Default explainable combination patterns.

    Ordered from more specific / stronger combinations to broader clusters.
    """
    chronology_cluster = frozenset(
        {
            TAG_MODIFICATION_BEFORE_CREATION,
            TAG_MODIFICATION_AFTER_AWARD,
            TAG_AWARD_AFTER_MODIFICATION,
            TAG_AWARD_BEFORE_CREATION,
            TAG_EXPIRATION_BEFORE_AWARD,
            TAG_IMPOSSIBLE_CHRONOLOGY,
            TAG_INVALID_TIMESTAMPS,
        }
    )
    identity_gaps = frozenset(
        {
            TAG_MISSING_CERTIFICATE_ID,
            TAG_MISSING_HOLDER_NAME,
            TAG_MISSING_ISSUER,
            TAG_OCR_MISSING_IMPORTANT_FIELDS,
            TAG_OCR_EMPTY,
        }
    )
    metadata_gaps = frozenset(
        {
            TAG_EMPTY_METADATA,
            TAG_MISSING_PRODUCER,
            TAG_MISSING_CREATION_DATE,
            TAG_UNKNOWN_PRODUCER,
        }
    )

    return (
        ContextualPattern(
            pattern_id="CTX_DESIGN_TOOL_EDIT_AFTER_AWARD_MISSING_ID",
            title="Design-tool edit after award with missing certificate ID",
            rationale=(
                "A design/image-editing producer, a modification timestamp after the "
                "award/issue date, and a missing certificate ID together suggest the "
                "file may have been reworked after issuance without a stable credential "
                "anchor. Each signal alone can be benign; the combination is stronger."
            ),
            required_tags=frozenset(
                {
                    TAG_SUSPICIOUS_PRODUCER,
                    TAG_MODIFICATION_AFTER_AWARD,
                    TAG_MISSING_CERTIFICATE_ID,
                }
            ),
            severity="critical",
            status="fail",
            confidence=0.92,
            recommendation=(
                "Corroborate producer software, post-award modification timing, and the "
                "absence of a certificate ID against the visible document and issuer records."
            ),
        ),
        ContextualPattern(
            pattern_id="CTX_DESIGN_TOOL_WITH_IMPOSSIBLE_DATES",
            title="Design-tool producer with impossible date chronology",
            rationale=(
                "Impossible or contradictory timestamps combined with design-tool "
                "provenance is a stronger integrity concern than either indicator alone."
            ),
            required_tags=frozenset({TAG_SUSPICIOUS_PRODUCER}),
            supporting_tags=frozenset(
                {
                    TAG_MODIFICATION_BEFORE_CREATION,
                    TAG_EXPIRATION_BEFORE_AWARD,
                    TAG_IMPOSSIBLE_CHRONOLOGY,
                }
            ),
            min_supporting=1,
            severity="critical",
            status="fail",
            confidence=0.9,
            recommendation=(
                "Inspect timestamp contradictions and the producing application together."
            ),
        ),
        ContextualPattern(
            pattern_id="CTX_DESIGN_TOOL_POST_AWARD_IDENTITY_GAP",
            title="Design-tool post-award change with identity field gaps",
            rationale=(
                "Post-award modification from a design tool plus missing holder/issuer "
                "identity fields increases concern that certificate identity may have "
                "been altered or incompletely reconstructed."
            ),
            required_tags=frozenset(
                {
                    TAG_SUSPICIOUS_PRODUCER,
                    TAG_MODIFICATION_AFTER_AWARD,
                }
            ),
            supporting_tags=frozenset(
                {
                    TAG_MISSING_HOLDER_NAME,
                    TAG_MISSING_ISSUER,
                    TAG_OCR_MISSING_IMPORTANT_FIELDS,
                }
            ),
            min_supporting=1,
            severity="critical",
            status="fail",
            confidence=0.88,
            recommendation=(
                "Verify holder and issuer fields against the document face and issuer systems."
            ),
        ),
        ContextualPattern(
            pattern_id="CTX_STRIPPED_METADATA_AND_IDENTITY",
            title="Stripped metadata combined with missing identity fields",
            rationale=(
                "Empty or missing core metadata together with missing certificate identity "
                "fields is more suspicious than either gap alone, because provenance and "
                "identity anchors are both weak."
            ),
            require_any_groups=(metadata_gaps, identity_gaps),
            severity="warning",
            status="warning",
            confidence=0.8,
            recommendation=(
                "Treat simultaneous metadata and identity gaps as a combined provenance concern."
            ),
        ),
        ContextualPattern(
            pattern_id="CTX_CHRONOLOGY_CLUSTER",
            title="Multiple chronology inconsistencies",
            rationale=(
                "Several independent date/time contradictions reinforce each other and "
                "are stronger than a single chronology warning."
            ),
            supporting_tags=chronology_cluster,
            min_supporting=2,
            severity="critical",
            status="fail",
            confidence=0.9,
            recommendation=(
                "Reconcile all conflicting timestamps across OCR fields and PDF metadata."
            ),
        ),
        ContextualPattern(
            pattern_id="CTX_SUSPICIOUS_PRODUCER_EMPTY_METADATA",
            title="Suspicious producer with empty or sparse metadata",
            rationale=(
                "Design-tool producers paired with empty/missing metadata reduce "
                "trust in document provenance more than either signal alone."
            ),
            required_tags=frozenset({TAG_SUSPICIOUS_PRODUCER}),
            supporting_tags=frozenset(
                {
                    TAG_EMPTY_METADATA,
                    TAG_MISSING_CREATION_DATE,
                    TAG_MISSING_PRODUCER,
                }
            ),
            min_supporting=1,
            severity="warning",
            status="warning",
            confidence=0.82,
            recommendation=(
                "Note that design software plus sparse metadata is a supportive warning, "
                "not a forgery declaration."
            ),
        ),
        ContextualPattern(
            pattern_id="CTX_UNKNOWN_PRODUCER_WITH_POST_AWARD_EDIT",
            title="Unknown producer with post-award modification",
            rationale=(
                "An unrecognized producer together with modification after the award date "
                "warrants closer provenance review than either indicator alone."
            ),
            required_tags=frozenset(
                {
                    TAG_UNKNOWN_PRODUCER,
                    TAG_MODIFICATION_AFTER_AWARD,
                }
            ),
            severity="warning",
            status="warning",
            confidence=0.78,
            recommendation=(
                "Research the producer string and confirm whether post-award modification "
                "matches an expected scan/export workflow."
            ),
        ),
    )
