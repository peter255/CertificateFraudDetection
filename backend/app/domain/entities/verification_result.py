from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.domain.enums.recommendation_type import RecommendationType
from app.domain.enums.risk_level import RiskLevel
from app.domain.enums.verification_status import VerificationStatus


@dataclass(frozen=True)
class VerificationResult:
    """
    The authoritative verdict for a certificate verification session.

    Aggregates the overall status, risk assessment, recommended action,
    and a machine-generated confidence score into a single immutable record.
    The summary field carries a human-readable explanation of the verdict.
    """

    result_id: uuid.UUID
    overall_status: VerificationStatus
    risk_level: RiskLevel
    recommendation: RecommendationType
    confidence_score: float
    summary: str

    def __post_init__(self) -> None:
        if not 0.0 <= self.confidence_score <= 1.0:
            raise ValueError("confidence_score must be within [0.0, 1.0].")
        if not self.summary.strip():
            raise ValueError("Result summary cannot be blank.")

    @classmethod
    def create(
        cls,
        overall_status: VerificationStatus,
        risk_level: RiskLevel,
        recommendation: RecommendationType,
        confidence_score: float,
        summary: str,
    ) -> VerificationResult:
        """Factory that generates a fresh identity and validates inputs."""
        return cls(
            result_id=uuid.uuid4(),
            overall_status=overall_status,
            risk_level=risk_level,
            recommendation=recommendation,
            confidence_score=confidence_score,
            summary=summary,
        )

    @property
    def is_fraudulent(self) -> bool:
        return self.overall_status == VerificationStatus.FRAUDULENT

    @property
    def requires_manual_review(self) -> bool:
        return self.recommendation == RecommendationType.MANUAL_REVIEW

    def __str__(self) -> str:
        return (
            f"{self.overall_status} | Risk: {self.risk_level.name} | "
            f"Confidence: {self.confidence_score:.0%}"
        )
