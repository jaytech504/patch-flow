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

    # Incident pipeline thresholds (used by SDK incident pipeline)
    incident_min_events: int = 3       # occurrences before fix is triggered
    incident_min_users: int = 1
    incident_environments: str = "production"

    # Lemon Squeezy Billing
    lemon_squeezy_api_key: str = ""
    lemon_squeezy_store_id: str = ""
    lemon_squeezy_webhook_secret: str = ""
    lemon_squeezy_pro_monthly_variant_id: str = ""
    lemon_squeezy_pro_annual_variant_id: str = ""
    lemon_squeezy_team_monthly_variant_id: str = ""
    lemon_squeezy_team_annual_variant_id: str = ""

    # Email Service (Resend or SMTP)
    resend_api_key: str = ""
    email_from: str = "PatchFlow Alerts <alerts@patchflow.dev>"

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def incident_env_list(self) -> list[str]:
        return [e.strip().lower() for e in self.incident_environments.split(",") if e.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
