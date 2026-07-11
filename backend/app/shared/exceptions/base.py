from __future__ import annotations


class ApplicationError(Exception):
    """Root exception for all application-level errors."""

    def __init__(self, message: str, code: str) -> None:
        super().__init__(message)
        self.code = code


class DomainError(ApplicationError):
    """Raised when a domain invariant or business rule is violated."""


class InfrastructureError(ApplicationError):
    """Raised when an external system or I/O dependency fails."""


class VendorError(InfrastructureError):
    """Raised when a third-party verification vendor returns an error or unexpected response."""


class AiProviderError(InfrastructureError):
    """Raised when the AI analysis provider is unavailable or returns an unusable response."""


class StorageError(InfrastructureError):
    """Raised when a document storage operation fails."""
