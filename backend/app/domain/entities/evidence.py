from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class Evidence:
    """
    A discrete, traceable piece of evidence that supports a verification finding.

    Evidence is sourced from the raw document content or from vendor responses.
    Each instance is immutable and carries its own identity so it can be
    cross-referenced from signals inside the same session aggregate.
    """

    evidence_id: uuid.UUID
    title: str
    description: str
    content_excerpt: str | None = None

    def __post_init__(self) -> None:
        if not self.title.strip():
            raise ValueError("Evidence title cannot be blank.")
        if not self.description.strip():
            raise ValueError("Evidence description cannot be blank.")

    @classmethod
    def create(
        cls,
        title: str,
        description: str,
        content_excerpt: str | None = None,
    ) -> Evidence:
        """Factory that generates a fresh identity and validates inputs."""
        return cls(
            evidence_id=uuid.uuid4(),
            title=title,
            description=description,
            content_excerpt=content_excerpt,
        )

    def __str__(self) -> str:
        return f"[{self.evidence_id}] {self.title}"
