from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "smart_bus_db"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    SECRET_KEY: str = "dev-secret-key"

    # API
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Smart Bus Ticketing System"
    PROJECT_VERSION: str = "1.0.0"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            f"?charset=utf8mb4"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
