from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from urllib.parse import quote_plus

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables or .env file.
    Uses pydantic-settings for type-safe configuration management.
    Sensitive values are never logged (handled at the API layer).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    app_env: str = Field(default="development", description="Runtime environment")
    app_name: str = Field(default="Financial Platform API")
    app_version: str = Field(default="1.0.0")
    app_secret_key: str = Field(default="changeme")
    cors_origins: list[str] = Field(default=["http://localhost:5173"])

    # --- Database (MariaDB) ---
    db_host: str = Field(default="localhost")
    db_port: int = Field(default=3306)
    db_name: str = Field(default="financial_platform")
    db_user: str = Field(default="fp_user")
    db_password: str = Field(default="changeme")

    # --- Financial Parameters ---
    default_currency: str = Field(default="USD")
    default_benchmark: str = Field(default="SPY")
    risk_free_rate: float = Field(default=0.043, description="Annual risk-free rate (decimal)")
    default_history_years: int = Field(default=5)

    # --- yfinance ---
    yfinance_cache_ttl: int = Field(default=3600, description="Cache TTL in seconds")

    @property
    def database_url(self) -> str:
        """Async-compatible MariaDB connection URL for SQLAlchemy."""
        safe_user = quote_plus(self.db_user)
        safe_password = quote_plus(self.db_password)

        return (
            f"mysql+aiomysql://{safe_user}:{safe_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    """Returns a cached singleton Settings instance."""
    return Settings()


# Module-level singleton for convenient import
settings = get_settings()
