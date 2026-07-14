from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    """
    Application configuration loaded from environment variables or a .env file.

    Each vendor has independent credentials and timeouts so one vendor can be
    disabled or reconfigured without touching another.
    """

    app_host: str = "0.0.0.0"
    app_port: int = 8000

    truthscan_api_key: str = ""
    truthscan_base_url: str = ""
    truthscan_timeout: float = 60.0

    paperwork_api_key: str = ""
    paperwork_base_url: str = ""
    paperwork_timeout: float = 300.0

    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = ""

    azure_document_intelligence_endpoint: str = ""
    azure_document_intelligence_key: str = ""
    azure_document_intelligence_model: str = "prebuilt-document"
    azure_document_intelligence_timeout: float = 120.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)


@lru_cache(maxsize=1)

def get_settings() -> Settings:

    """Singleton accessor cached for the lifetime of the process."""

    return Settings()
