from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Urban Intelligence Platform"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/urban_db"

    # JWT
    secret_key: str = "changeme"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Redis (optional, for caching/GPS streams)
    redis_url: str = "redis://localhost:6379"

    # Supabase Storage (for incident images)
    supabase_url: str = ""  # e.g. https://xyz.supabase.co
    supabase_key: str = ""  # anon or service_role key
    supabase_bucket: str = "incidents"
    supabase_image_key_prefix: str = "incidents/"

    # SMTP (from .env: SMTP_HOST, SMTP_PORT, etc.)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    # OTP
    otp_expire_minutes: int = 5
    otp_resend_cooldown_seconds: int = 60

    class Config:
        # Resolve .env relative to this file so it works regardless of CWD.
        # Tries: backend/.env then project-root/.env ; Docker injects env via env vars anyway.
        env_file = (
            str(Path(__file__).resolve().parent.parent / ".env"),
            str(Path(__file__).resolve().parent.parent.parent / ".env"),
            ".env",
            "../.env",
        )
        env_file_encoding = "utf-8"
        extra = "allow"


@lru_cache
def get_settings() -> Settings:
    return Settings()
