from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Weatherly"
    cors_origins: list[str] = ["http://localhost:8000", "http://127.0.0.1:8000"]
    open_meteo_base_url: str = "https://api.open-meteo.com/v1"
    open_meteo_geocoding_url: str = "https://geocoding-api.open-meteo.com/v1/search"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
