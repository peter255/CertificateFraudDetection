from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class HolderName:
    """Full name of the individual or entity to whom the certificate was issued."""

    value: str

    def __post_init__(self) -> None:
        if not self.value or not self.value.strip():
            raise ValueError("Holder name cannot be blank.")

    def __str__(self) -> str:
        return self.value
