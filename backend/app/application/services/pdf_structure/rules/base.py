from __future__ import annotations

from typing import Any, Protocol

from app.application.dto.pdf_structure import PdfStructureFinding
from app.application.services.pdf_structure.context import PdfStructureContext


class ForensicRule(Protocol):
    """Extensible forensic rule contract — return a finding or None when not applicable."""

    @property
    def rule_id(self) -> str: ...

    def evaluate(self, context: PdfStructureContext) -> PdfStructureFinding | None: ...


def finding(
    *,
    rule_id: str,
    severity: str,
    status: str,
    title: str,
    description: str,
    evidence: dict[str, Any] | None = None,
    recommendation: str = "",
    confidence: float = 0.8,
) -> PdfStructureFinding:
    return PdfStructureFinding(
        rule_id=rule_id,
        severity=severity,
        status=status,
        title=title,
        description=description,
        evidence=evidence or {},
        recommendation=recommendation,
        confidence=max(0.0, min(1.0, confidence)),
    )
