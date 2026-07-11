from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class CertificateId:
    """Unique identifier for a certificate, backed by a UUID."""

    value: uuid.UUID

    @classmethod
    def generate(cls) -> CertificateId:
        return cls(value=uuid.uuid4())

    @classmethod
    def from_string(cls, raw: str) -> CertificateId:
        return cls(value=uuid.UUID(raw))

    def __str__(self) -> str:
        return str(self.value)
