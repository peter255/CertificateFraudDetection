from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, TypeVar, Union

T = TypeVar("T")
E = TypeVar("E")


@dataclass(frozen=True)
class Success(Generic[T]):
    """Wraps a successful computation value."""

    value: T


@dataclass(frozen=True)
class Failure(Generic[E]):
    """Wraps a failed computation error."""

    error: E


Result = Union[Success[T], Failure[E]]
