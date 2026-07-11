from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.domain.entities.annotation import Annotation
from app.domain.entities.evidence import Evidence
from app.domain.entities.verification_result import VerificationResult
from app.domain.entities.verification_signal import VerificationSignal
from app.domain.enums.verification_status import VerificationStatus
from app.domain.value_objects.certificate_id import CertificateId
from app.domain.value_objects.file_information import FileInformation


@dataclass(frozen=True)
class VerificationSession:
    """
    Aggregate root representing the complete lifecycle of one certificate verification.

    A session starts PENDING (via `open`) and transitions to a terminal status
    (via `close`) once all vendor checks and AI analysis are complete.
    All child objects — result, signals, annotations, evidence — are owned
    exclusively by their session.
    """

    session_id: uuid.UUID
    certificate_id: CertificateId
    file_information: FileInformation
    status: VerificationStatus
    result: VerificationResult | None
    signals: tuple[VerificationSignal, ...]
    annotations: tuple[Annotation, ...]
    evidence: tuple[Evidence, ...]
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    def __post_init__(self) -> None:
        if self.status != VerificationStatus.PENDING and self.result is None:
            raise ValueError(
                "A non-pending session must carry a VerificationResult."
            )

    # ------------------------------------------------------------------
    # Lifecycle transitions
    # ------------------------------------------------------------------

    @classmethod
    def open(
        cls,
        certificate_id: CertificateId,
        file_information: FileInformation,
    ) -> VerificationSession:
        """
        Create a fresh session in PENDING state.

        Called at the start of a verification use case before any
        vendor calls are made.
        """
        return cls(
            session_id=uuid.uuid4(),
            certificate_id=certificate_id,
            file_information=file_information,
            status=VerificationStatus.PENDING,
            result=None,
            signals=(),
            annotations=(),
            evidence=(),
        )

    def close(
        self,
        result: VerificationResult,
        signals: tuple[VerificationSignal, ...],
        annotations: tuple[Annotation, ...],
        evidence: tuple[Evidence, ...],
    ) -> VerificationSession:
        """
        Return a completed, immutable session with all findings attached.

        Because the entity is frozen, this returns a new instance rather
        than mutating in place. The session_id and created_at are preserved
        to maintain identity continuity.
        """
        return VerificationSession(
            session_id=self.session_id,
            certificate_id=self.certificate_id,
            file_information=self.file_information,
            status=result.overall_status,
            result=result,
            signals=signals,
            annotations=annotations,
            evidence=evidence,
            created_at=self.created_at,
        )

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    @property
    def is_complete(self) -> bool:
        return self.status != VerificationStatus.PENDING

    @property
    def critical_signals(self) -> tuple[VerificationSignal, ...]:
        return tuple(s for s in self.signals if s.is_critical)

    def __str__(self) -> str:
        return (
            f"VerificationSession({self.session_id}, "
            f"cert={self.certificate_id}, status={self.status})"
        )
