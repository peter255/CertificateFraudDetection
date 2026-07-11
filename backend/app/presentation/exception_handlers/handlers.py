from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

from app.shared.exceptions.base import DomainError, InfrastructureError


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    """
    Maps DomainError to HTTP 422 Unprocessable Entity.

    Domain errors represent violated business rules that the caller can correct,
    so the error code and message are safe to expose in the response body.
    """
    return JSONResponse(
        status_code=422,
        content={"code": exc.code, "message": str(exc)},
    )


async def infrastructure_error_handler(request: Request, exc: InfrastructureError) -> JSONResponse:
    """
    Maps InfrastructureError to HTTP 503 Service Unavailable.

    Vendor-facing messages (already sanitized by adapters) are forwarded so the
    UI can explain why verification did not complete. Stack traces are never included.
    """
    message = str(exc).strip() or "A downstream service is temporarily unavailable."
    return JSONResponse(
        status_code=503,
        content={"code": exc.code, "message": message},
    )
