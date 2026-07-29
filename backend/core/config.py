from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    gemma_api_key: str = ""
    gemma_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    gemma_model: str = "gemma-4-26b-a4b-it"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/chaos_agent"
    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""

    # GitHub — optional fallback (for demo/dev use without OAuth)
    github_token: str = ""

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

    @property
    def formatted_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
