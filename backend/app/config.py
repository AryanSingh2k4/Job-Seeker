from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = Field(
        default="127.0.0.1",
        validation_alias=AliasChoices("AUTOJOB_HOST", "host"),
    )
    port: int = Field(
        default=8000,
        validation_alias=AliasChoices("AUTOJOB_PORT", "port"),
    )
    data_dir: Path = Field(
        default=Path("./data"),
        validation_alias=AliasChoices("AUTOJOB_DATA_DIR", "data_dir"),
    )
    db_path: Path = Field(
        default=Path("data/autojob.db"),
        validation_alias=AliasChoices("AUTOJOB_DB_PATH", "db_path"),
    )
    browser_profile: Path = Field(
        default=Path("data/browser-profile"),
        validation_alias=AliasChoices("AUTOJOB_BROWSER_PROFILE", "browser_profile"),
    )
    output_dir: Path = Field(
        default=Path("data/output"),
        validation_alias=AliasChoices("AUTOJOB_OUTPUT_DIR", "output_dir"),
    )
    fixtures_dir: Path = Field(
        default=Path("fixtures"),
        validation_alias=AliasChoices("AUTOJOB_FIXTURES_DIR", "fixtures_dir"),
    )
    templates_dir: Path = Field(
        default=Path("templates"),
        validation_alias=AliasChoices("AUTOJOB_TEMPLATES_DIR", "templates_dir"),
    )
    llm_provider: str = Field(
        default="openai",
        validation_alias=AliasChoices("LLM_PROVIDER", "llm_provider"),
    )
    llm_model: str = Field(
        default="gpt-4o-mini",
        validation_alias=AliasChoices("LLM_MODEL", "llm_model"),
    )
    llm_model_strong: str = Field(
        default="gpt-4o",
        validation_alias=AliasChoices("LLM_MODEL_STRONG", "llm_model_strong"),
    )
    embed_model: str = Field(
        default="all-MiniLM-L6-v2",
        validation_alias=AliasChoices("EMBED_MODEL", "embed_model"),
    )
    crawl_interval_minutes: int = Field(
        default=5,
        validation_alias=AliasChoices(
            "CRAWL_INTERVAL_MINUTES", "crawl_interval_minutes"
        ),
    )
    parent_pid: int | None = Field(
        default=None,
        validation_alias=AliasChoices("PARENT_PID", "parent_pid"),
    )
    shutdown_grace: int = Field(
        default=5,
        validation_alias=AliasChoices("SHUTDOWN_GRACE", "shutdown_grace"),
    )
    log_level: str = Field(
        default="info",
        validation_alias=AliasChoices("LOG_LEVEL", "log_level"),
    )
    token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("AUTOJOB_TOKEN", "token"),
    )
    linkedin_opt_in: bool = Field(
        default=False,
        validation_alias=AliasChoices("AUTOJOB_LINKEDIN_OPT_IN", "linkedin_opt_in"),
    )
    autonomous_opt_in: bool = Field(
        default=False,
        validation_alias=AliasChoices("AUTOJOB_AUTONOMOUS_OPT_IN", "autonomous_opt_in"),
    )
    daily_app_limit: int = Field(
        default=20,
        validation_alias=AliasChoices("AUTOJOB_DAILY_APP_LIMIT", "daily_app_limit"),
    )
    browser_headless: bool = Field(
        default=False,
        validation_alias=AliasChoices("AUTOJOB_BROWSER_HEADLESS", "browser_headless"),
    )

    @property
    def database_url(self) -> str:
        resolved_db_path = self.db_path.resolve()
        return f"sqlite:///{resolved_db_path.as_posix()}"

    def ensure_directories(self) -> None:
        """Ensure necessary runtime directories exist."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.browser_profile.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "backups").mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
