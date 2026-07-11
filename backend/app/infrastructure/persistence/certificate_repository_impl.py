from __future__ import annotations

from app.domain.entities.certificate import Certificate
from app.domain.repositories.certificate_repository import ICertificateRepository
from app.domain.value_objects.certificate_id import CertificateId


class CertificateRepositoryImpl(ICertificateRepository):
    """
    Concrete ICertificateRepository backed by the configured persistence store.

    Connection management, query building, and ORM/driver interactions
    will live here. Domain objects are always fully reconstructed before
    being returned; no ORM models leak past this boundary.
    """

    async def save(self, certificate: Certificate) -> None:
        raise NotImplementedError

    async def find_by_id(self, certificate_id: CertificateId) -> Certificate | None:
        raise NotImplementedError

    async def find_by_hash(self, document_hash: str) -> Certificate | None:
        raise NotImplementedError
