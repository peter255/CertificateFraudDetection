from __future__ import annotations

from app.application.dto.pdf_structure import PdfStructureFinding
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.rules.base import ForensicRule
from app.application.services.pdf_structure.rules.chronology import (
    AwardAfterModificationRule,
    AwardAfterFileModificationRule,
    AwardBeforeCreationRule,
    AwardBeforeFileModificationRule,
    ExpirationBeforeAwardRule,
    ImpossibleChronologyRule,
    InvalidTimestampsRule,
    ModificationBeforeCreationRule,
)
from app.application.services.pdf_structure.rules.metadata import (
    EmptyMetadataRule,
    MetadataInconsistencyRule,
    MissingCreationDateRule,
    MissingCreatorRule,
    MissingProducerRule,
)
from app.application.services.pdf_structure.rules.editing_software import (
    EditingSoftwareDetectedRule,
)
from app.application.services.pdf_structure.rules.ocr_fields import OcrMissingImportantFieldsRule
from app.application.services.pdf_structure.rules.producer import (
    SuspiciousProducerRule,
    UnknownProducerRule,
)


class ForensicRuleRegistry:
    """
    Ordered, extensible registry of forensic PDF structure rules.

    Add new rules by passing them to the constructor or calling `register`.
    """

    def __init__(self, rules: list[ForensicRule] | None = None) -> None:
        self._rules: list[ForensicRule] = list(rules or [])

    def register(self, rule: ForensicRule) -> None:
        self._rules.append(rule)

    @property
    def rules(self) -> tuple[ForensicRule, ...]:
        return tuple(self._rules)

    def evaluate_all(self, context: PdfStructureContext) -> list[PdfStructureFinding]:
        findings: list[PdfStructureFinding] = []
        for rule in self._rules:
            result = rule.evaluate(context)
            if result is not None:
                findings.append(result)
        return findings


def build_default_rule_registry() -> ForensicRuleRegistry:
    """Default forensic rule set for PDF Structure Analysis."""
    return ForensicRuleRegistry(
        [
            ModificationBeforeCreationRule(),
            AwardBeforeCreationRule(),
            AwardAfterModificationRule(),
            AwardAfterFileModificationRule(),
            AwardBeforeFileModificationRule(),
            ExpirationBeforeAwardRule(),
            MissingCreationDateRule(),
            MissingProducerRule(),
            MissingCreatorRule(),
            SuspiciousProducerRule(),
            EditingSoftwareDetectedRule(),
            UnknownProducerRule(),
            EmptyMetadataRule(),
            InvalidTimestampsRule(),
            ImpossibleChronologyRule(),
            OcrMissingImportantFieldsRule(),
            MetadataInconsistencyRule(),
        ]
    )
