"""GreenStep API (FastAPI). 모든 경로는 /api/v1 아래 — 프론트 web/src/api/endpoints.ts 와 같습니다."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.routers import auth, org, public

API = "/api/v1"

app = FastAPI(title="GreenStep API", version="0.1.0", docs_url=f"{API}/docs", openapi_url=f"{API}/openapi.json")

app.include_router(auth.router, prefix=API)
app.include_router(org.router, prefix=API)
app.include_router(public.router, prefix=API)


@app.get(f"{API}/health", include_in_schema=False)
def health() -> dict:
    return {"ok": True}


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    # 프론트 http 클라이언트는 {detail: string} 을 오류 문구로 표시 → 첫 오류의 필드 이름을 알려 줌
    err = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(x) for x in err.get("loc", [])[1:]) or "입력값"
    return JSONResponse({"detail": f"입력값을 확인해 주세요. ({field})"}, status_code=422)


# 아직 서버에 없는 기능 (신청·활동 기록·이력서·CSR 보고서 등) → 501 + 안내 문구
# 반드시 다른 라우터 뒤에 등록 (가장 마지막에 매칭)
@app.api_route(f"{API}/{{rest:path}}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def not_implemented(rest: str) -> JSONResponse:
    return JSONResponse(
        {"detail": "이 기능은 아직 서버(API)에 구현되지 않았습니다. mock 모드(VITE_API_MODE=mock)에서 시연할 수 있습니다."},
        status_code=501,
    )
