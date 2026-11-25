"""비밀번호 해시(argon2)와 토큰(JWT).
- access 토큰: 응답 본문으로 전달 → 프론트가 메모리에만 보관, Authorization: Bearer 로 전송
- refresh 토큰: httpOnly 쿠키 (자바스크립트에서 읽을 수 없음)
"""
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

Role = Literal["YOUTH", "ORG"]
REFRESH_COOKIE = "gs_refresh"
REFRESH_PATH = "/api/v1/auth"

_hasher = PasswordHasher()
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


@dataclass(frozen=True)
class Principal:
    role: Role
    user_id: uuid.UUID
    member_id: uuid.UUID | None  # ORG 일 때 org_members.member_id


def _encode(p: Principal, typ: str, ttl: timedelta) -> str:
    now = datetime.now(UTC)
    payload = {"sub": str(p.user_id), "role": p.role, "typ": typ, "iat": now, "exp": now + ttl}
    if p.member_id:
        payload["mid"] = str(p.member_id)
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _decode(token: str, typ: str) -> Principal:
    try:
        data = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "로그인이 만료되었습니다. 다시 로그인해 주세요.") from None
    if data.get("typ") != typ:
        raise HTTPException(401, "잘못된 토큰입니다.")
    mid = data.get("mid")
    return Principal(role=data["role"], user_id=uuid.UUID(data["sub"]), member_id=uuid.UUID(mid) if mid else None)


def access_token(p: Principal) -> str:
    return _encode(p, "access", timedelta(minutes=settings.access_ttl_minutes))


def set_refresh_cookie(response: Response, p: Principal) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        _encode(p, "refresh", timedelta(days=settings.refresh_ttl_days)),
        max_age=settings.refresh_ttl_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path=REFRESH_PATH,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH)


def principal_from_refresh(request: Request) -> Principal:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(401, "로그인이 필요합니다.")
    return _decode(token, "refresh")


def optional_principal(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> Principal | None:
    return _decode(cred.credentials, "access") if cred else None


def current_principal(p: Principal | None = Depends(optional_principal)) -> Principal:
    if p is None:
        raise HTTPException(401, "로그인이 필요합니다.")
    return p
