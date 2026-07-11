from __future__ import annotations

import hashlib
from dataclasses import dataclass


@dataclass(frozen=True)
class DocumentHash:
    """SHA-256 fingerprint of the raw document bytes, used for deduplication and tamper detection."""

    value: str

    @classmethod
    def from_bytes(cls, content: bytes) -> DocumentHash:
        return cls(value=hashlib.sha256(content).hexdigest())

    def __str__(self) -> str:
        return self.value
