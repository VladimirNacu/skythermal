from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "local"
    database_url: str = "postgresql://pip:pip@localhost:5433/pip"
    redis_url: str = "redis://localhost:6380/0"
    safety_disclaimer: str = "Decision support only. Verify actual conditions at launch."

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

