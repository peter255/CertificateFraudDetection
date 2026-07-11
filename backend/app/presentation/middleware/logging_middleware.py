from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.shared.logging.logger import get_logger

logger = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Logs method, path, and response status for every HTTP request.

    Intentionally kept minimal: no body inspection, no PII logging.
    Structured logging fields can be added here when a log aggregator is wired in.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        logger.info("%s %s", request.method, request.url.path)
        response = await call_next(request)
        logger.info("→ %s", response.status_code)
        return response
