from __future__ import annotations

from fastapi import Depends

from app.infrastructure.configuration.settings import Settings, get_settings
from app.infrastructure.vendors.truthscan.client import TruthScanClient


def provide_settings() -> Settings:
    return get_settings()


def provide_truthscan_client(
    settings: Settings = Depends(provide_settings),
) -> TruthScanClient:
    """Engine V1 route receives only its client — no engine switching."""
    return TruthScanClient(settings=settings)
