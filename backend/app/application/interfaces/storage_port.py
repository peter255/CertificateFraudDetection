from __future__ import annotations

from typing import Protocol


class IStoragePort(Protocol):
    """
    Outbound port for binary document storage.

    Implementations may target Azure Blob Storage, S3, or local disk.
    Returns a resolvable URI on upload so downstream services can reference the file.
    """

    async def upload(self, key: str, content: bytes, content_type: str) -> str: ...

    async def download(self, key: str) -> bytes: ...
