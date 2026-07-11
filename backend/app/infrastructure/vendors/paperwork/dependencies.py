from __future__ import annotations

from fastapi import Depends

from app.infrastructure.configuration.settings import Settings, get_settings
from app.infrastructure.vendors.paperwork.client import PaperworkClient


def provide_settings() -> Settings:
    return get_settings()


def provide_paperwork_client(
    settings: Settings = Depends(provide_settings),
) -> PaperworkClient:
    """Engine V2 route receives only its client — no engine switching."""
    return PaperworkClient(settings=settings)
