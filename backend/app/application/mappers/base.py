from __future__ import annotations

from typing import Generic, Protocol, TypeVar

TDomain = TypeVar("TDomain")
TDto = TypeVar("TDto")


class IMapper(Protocol[TDomain, TDto]):
    """
    Bidirectional translator between a domain object and its DTO counterpart.

    Mappers live in the application layer because they know about both
    the domain model and the DTO shape — a dependency neither layer
    should carry individually.
    """

    def to_dto(self, domain: TDomain) -> TDto: ...

    def to_domain(self, dto: TDto) -> TDomain: ...
