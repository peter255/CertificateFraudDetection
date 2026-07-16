from __future__ import annotations

import re

from app.application.dto.pdf_structure import PdfStructureFinding
from app.application.services.pdf_structure.context import PdfStructureContext
from app.application.services.pdf_structure.rules.base import finding
from app.application.services.pdf_structure.rules.producer import match_suspicious_producer

# Design / editing tools flagged when present as creator, producer, or modifier.
_EDITING_SOFTWARE_MARKERS: tuple[str, ...] = (
    "adobe photoshop",
    "photoshop",
    "canva",
    "paint.net",
    "paintnet",
    "microsoft paint",
    "mspaint",
    "paint",
    "gimp",
    "photopea",
    "pixlr",
    "coreldraw",
    "corel draw",
    "affinity designer",
    "affinity photo",
    "adobe acrobat",
    "acrobat",
    "adobe illustrator",
    "illustrator",
    "lightroom",
)


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def match_editing_software(value: str | None) -> str | None:
    """Return the matched editing-software marker, if any."""
    normalized = _normalize(value)
    if not normalized:
        return None

    ordered = sorted(_EDITING_SOFTWARE_MARKERS, key=len, reverse=True)
    for marker in ordered:
        if marker == "paint":
            if re.search(r"(?<![a-z])(?:ms\s*)?paint(?![a-z.])", normalized):
                return marker
            continue
        if marker in normalized:
            return marker
    return match_suspicious_producer(value)


class EditingSoftwareDetectedRule:
    rule_id = "PDF_EDITING_SOFTWARE_DETECTED"

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None:
        checks = (
            ("editing_producer", context.metadata.editing_producer),
            ("producer", context.metadata.producer),
            ("creator", context.metadata.creator),
        )
        for field, value in checks:
            hit = match_editing_software(value)
            if not hit:
                continue
            return finding(
                rule_id=self.rule_id,
                severity="warning",
                status="warning",
                title="Editing software detected in file metadata",
                description=(
                    f"The file {field} references editing or design software "
                    f"({hit}), which is uncommon for authentic certificate issuance workflows."
                ),
                evidence={
                    "field": field,
                    "value": value,
                    "matched_marker": hit,
                    "creator": context.metadata.creator,
                    "producer": context.metadata.producer,
                    "editing_producer": context.metadata.editing_producer,
                },
                recommendation=(
                    "Review provenance and compare against issuer records; "
                    "design-tool metadata alone is not proof of fraud."
                ),
                confidence=0.82,
            )
        return None
