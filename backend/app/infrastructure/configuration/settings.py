from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables or a .env file.

    Grouped into logical sections: server, TruthScan, Paperwork, Azure OpenAI.
    All vendor credentials default to empty strings so the app boots without them;
    individual adapters are responsible for validating their required fields on init.
    """

    app_host: str = "0.0.0.0"
    app_port: int = 8000

    truthscan_api_key: str = ""
    truthscan_base_url: str = ""

    paperwork_api_key: str = ""
    paperwork_base_url: str = ""

    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton accessor cached for the lifetime of the process."""
    return Settings()
