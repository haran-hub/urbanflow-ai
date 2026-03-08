from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./urbanflow.db"
    frontend_url: str = "http://localhost:3000"
    snapshot_interval_minutes: int = 2
    ai_model: str = "claude-haiku-4-5-20251001"
    default_city: str = "San Francisco"
    ocm_api_key: str = ""             # Open Charge Map (optional, higher rate limits)
    api_511_key: str = ""             # 511.org SF transit real-time (optional free key)
    ticketmaster_api_key: str = ""    # Ticketmaster Discovery API (free tier)
    resend_api_key: str = ""          # Resend email API (100 emails/day free)

    class Config:
        env_file = ".env"


settings = Settings()
