from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.presentation.api.router import router
from app.presentation.exception_handlers.handlers import domain_error_handler, infrastructure_error_handler
from app.presentation.middleware.logging_middleware import RequestLoggingMiddleware
from app.shared.exceptions.base import DomainError, InfrastructureError


def create_application() -> FastAPI:
    application = FastAPI(
        title="Certificate Fraud Detection API",
        version="1.0.0",
        description="Verifies certificate authenticity through multiple vendor checks and AI-assisted analysis.",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:3000"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_middleware(RequestLoggingMiddleware)
    application.add_exception_handler(DomainError, domain_error_handler)  # type: ignore[arg-type]
    application.add_exception_handler(InfrastructureError, infrastructure_error_handler)  # type: ignore[arg-type]
    application.include_router(router)

    return application


app = create_application()
