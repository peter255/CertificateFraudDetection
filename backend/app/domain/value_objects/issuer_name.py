from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class IssuerName:
    """Name of the authority that issued the certificate."""

    value: str

    def __post_init__(self) -> None:
        if not self.value or not self.value.strip():
            raise ValueError("Issuer name cannot be blank.")

    def __str__(self) -> str:
        return self.value
