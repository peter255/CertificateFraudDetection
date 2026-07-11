from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from app.domain.enums.signal_severity import SignalSeverity
from app.domain.enums.vendor_name import VendorName


@dataclass(frozen=True)
class VerificationSignal:
    """
    An individual anomaly or indicator detected by a verification vendor.

    Signals are the atomic unit of evidence in the domain: each signal
    names a category of concern, quantifies confidence, and references
    supporting evidence collected in the same session.
    """

    signal_id: uuid.UUID
    vendor: VendorName
    severity: SignalSeverity
    category: str
    description: str
    confidence: float
    evidence_ids: tuple[uuid.UUID, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("confidence must be within [0.0, 1.0].")
        if not self.category.strip():
            raise ValueError("Signal category cannot be blank.")
        if not self.description.strip():
            raise ValueError("Signal description cannot be blank.")

    @classmethod
    def create(
        cls,
        vendor: VendorName,
        severity: SignalSeverity,
        category: str,
        description: str,
        confidence: float,
        evidence_ids: tuple[uuid.UUID, ...] = (),
    ) -> VerificationSignal:
        """Factory that generates a fresh identity and validates inputs."""
        return cls(
            signal_id=uuid.uuid4(),
            vendor=vendor,
            severity=severity,
            category=category,
            description=description,
            confidence=confidence,
            evidence_ids=evidence_ids,
        )

    @property
    def is_critical(self) -> bool:
        return self.severity == SignalSeverity.CRITICAL

    def __str__(self) -> str:
        return f"[{self.vendor}/{self.severity.name}] {self.category}: {self.description}"
