from __future__ import annotations

from pydantic import BaseModel, ConfigDict, field_validator


class FileInformation(BaseModel):
    """
    Immutable descriptor for the uploaded certificate file.

    Carries the metadata the domain needs to reason about a file without
    holding the raw bytes. Validation is self-contained so callers cannot
    construct an invalid instance.
    """

    model_config = ConfigDict(frozen=True)

    filename: str
    file_size_bytes: int
    mime_type: str

    @field_validator("filename")
    @classmethod
    def _filename_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Filename cannot be blank.")
        return v.strip()

    @field_validator("file_size_bytes")
    @classmethod
    def _size_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("File size must be a positive number of bytes.")
        return v

    @field_validator("mime_type")
    @classmethod
    def _mime_type_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("MIME type cannot be blank.")
        if "/" not in v:
            raise ValueError("MIME type must follow the 'type/subtype' format.")
        return v.strip().lower()

    def __str__(self) -> str:
        return f"{self.filename} ({self.mime_type}, {self.file_size_bytes} bytes)"
