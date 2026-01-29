"""Configuration management using pydantic-settings."""

from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # API Configuration
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")

    # Temporal Configuration
    temporal_host: str = Field(default="localhost:7233", alias="TEMPORAL_HOST")
    temporal_namespace: str = Field(default="default", alias="TEMPORAL_NAMESPACE")
    temporal_task_queue: str = Field(
        default="novel-weaver-workflow", alias="TEMPORAL_TASK_QUEUE"
    )

    # Storage Configuration
    projects_root_dir: str = Field(
        default="~/.novel-weaver-studio/projects", alias="PROJECTS_ROOT_DIR"
    )

    # LLM API Keys
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_base_url: str = Field(
        default="https://api.openai.com/v1", alias="OPENAI_BASE_URL"
    )
    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    google_api_key: str | None = Field(default=None, alias="GOOGLE_API_KEY")

    # OpenRouter
    openrouter_api_key: str | None = Field(default=None, alias="OPENROUTER_API_KEY")

    # Default LLM Provider
    default_llm_provider: str = Field(default="openai", alias="DEFAULT_LLM_PROVIDER")

    # CORS Configuration
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:8080",
        alias="CORS_ORIGINS",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        if isinstance(self.cors_origins, str):
            return [origin.strip() for origin in self.cors_origins.split(",")]
        return self.cors_origins

    @property
    def projects_root_path(self) -> Path:
        """Get projects root directory as Path object, expanding ~."""
        return Path(self.projects_root_dir).expanduser()

    def validate_llm_keys(self) -> List[str]:
        """Return list of available LLM providers based on configured keys."""
        available = []
        if self.openai_api_key:
            available.append("openai")
        if self.anthropic_api_key:
            available.append("anthropic")
        if self.google_api_key:
            available.append("google")
        if self.openrouter_api_key:
            available.append("openrouter")
        return available


# Global settings instance
settings = Settings()
