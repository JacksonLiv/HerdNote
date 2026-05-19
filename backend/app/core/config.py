from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://cyberherd:change-me@db:5432/pentestreportmaker"
    session_secret: str = "dev-only-session-secret-change-me"
    app_secret_key: str = "dev-only-app-secret-change-me"
    cors_origins: str = "http://localhost:8080"
    evidence_dir: str = "/data/evidence"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
