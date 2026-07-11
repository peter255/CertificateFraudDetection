from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.entities.certificate import Certificate
from app.domain.value_objects.certificate_id import CertificateId


class ICertificateRepository(ABC):
    """
    Abstract persistence contract for Certificate aggregates.

    Infrastructure implementations must not leak storage details
    into the domain. All methods are async to support non-blocking I/O adapters.
    """

    @abstractmethod
    async def save(self, certificate: Certificate) -> None: ...

    @abstractmethod
    async def find_by_id(self, certificate_id: CertificateId) -> Certificate | None: ...

    @abstractmethod
    async def find_by_hash(self, document_hash: str) -> Certificate | None: ...
