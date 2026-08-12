from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    gemma_api_key: str = ""
    gemma_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    gemma_model: str = "gemma-4-26b-a4b-it"
    gemma_thinking_level: str = "minimal"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/chaos_agent"
    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""
    github_token: str = ""

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

    # Sentry integration (Phase 4)
    sentry_webhook_secret: str = ""        # HMAC secret from Sentry internal integration
    sentry_auth_token: str = ""            # Sentry auth token for API calls
    sentry_org: str = ""                   # Sentry org slug, e.g. "acme-corp"

    # Incident pipeline thresholds
    incident_min_events: int = 3           # minimum error event count before patching
    incident_min_users: int = 1            # minimum affected users before patching
    incident_environments: str = "production"  # comma-separated envs to process

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def incident_env_list(self) -> list[str]:
        return [e.strip().lower() for e in self.incident_environments.split(",") if e.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
