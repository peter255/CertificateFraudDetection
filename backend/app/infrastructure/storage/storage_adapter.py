from __future__ import annotations

from app.infrastructure.configuration.settings import Settings


class StorageAdapter:
    """
    Adapter that satisfies IStoragePort for binary document persistence.

    The target storage backend (Azure Blob Storage, local disk, etc.)
    is configured through Settings and injected at construction time.
    Upload and download mechanics are fully contained within this class.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def upload(self, key: str, content: bytes, content_type: str) -> str:
        raise NotImplementedError

    async def download(self, key: str) -> bytes:
        raise NotImplementedError
