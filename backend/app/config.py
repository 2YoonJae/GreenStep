"""환경변수 설정. 값은 docker-compose.yml 또는 backend/.env 에서 주입합니다."""
import os
from dataclasses import dataclass


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "postgresql+psycopg://greenstep:greenstep@localhost:5432/greenstep")
    # 운영에서는 반드시 긴 임의 문자열로 바꿉니다 (openssl rand -hex 32)
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-only-change-me")
    access_ttl_minutes: int = int(os.getenv("ACCESS_TTL_MINUTES", "15"))
    refresh_ttl_days: int = int(os.getenv("REFRESH_TTL_DAYS", "14"))
    # HTTPS 로 서비스할 때 true (refresh 쿠키 Secure 속성)
    cookie_secure: bool = _bool("COOKIE_SECURE", False)
    # 데모 기능: 데모 계정 시드 + 기관 심사 승인 버튼 API
    demo_mode: bool = _bool("DEMO_MODE", True)


settings = Settings()
