from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass(frozen=True)
class Annotation:
    """
    A textual note attached to a verification session.

    Annotations carry either an AI-generated narrative summary or a
    human reviewer comment. The is_ai_generated flag allows consumers
    to apply different presentation treatment to each source.
    """

    annotation_id: uuid.UUID
    content: str
    author: str
    is_ai_generated: bool
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    def __post_init__(self) -> None:
        if not self.content.strip():
            raise ValueError("Annotation content cannot be blank.")
        if not self.author.strip():
            raise ValueError("Annotation author cannot be blank.")

    @classmethod
    def from_ai(cls, content: str) -> Annotation:
        """Convenience factory for AI-generated annotations."""
        return cls(
            annotation_id=uuid.uuid4(),
            content=content,
            author="AI Analysis",
            is_ai_generated=True,
        )

    @classmethod
    def from_reviewer(cls, content: str, reviewer: str) -> Annotation:
        """Convenience factory for human reviewer annotations."""
        return cls(
            annotation_id=uuid.uuid4(),
            content=content,
            author=reviewer,
            is_ai_generated=False,
        )

    def __str__(self) -> str:
        tag = "AI" if self.is_ai_generated else self.author
        return f"[{tag}] {self.content[:80]}"
