from __future__ import annotations

from typing import Generic, Protocol, TypeVar

TRequest = TypeVar("TRequest")
TResponse = TypeVar("TResponse")


class IUseCase(Protocol[TRequest, TResponse]):
    """
    Generic contract for all application use cases.

    Each concrete use case receives a strongly-typed request DTO and
    returns a strongly-typed response DTO. Side effects are contained
    within the use case boundary and coordinated through ports.
    """

    async def execute(self, request: TRequest) -> TResponse: ...
