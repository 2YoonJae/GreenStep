# GreenStep — 프로젝트 안내 (Claude용)

팀 아이스볼의 ESG 소프트웨어 창업 수업 프로젝트. 청년의 봉사활동을 SROI(사회적 가치, 원)로 환산해 청년에게는 **봉사 이력서**를, 기관에는 **ESG 경영 보고서**를 제공하는 플랫폼.

- GitHub: https://github.com/2YoonJae/GreenStep (public, 브랜치 `main`, **레포 최상위 = `src/` 폴더**)
- 사용자용 상세 문서: `src/README.md` (기능·아키텍처·실행법). 구조가 바뀌면 README도 함께 고친다.

## 기획 원본 (Notion, 공유 페이지)

명세가 애매하면 코드보다 먼저 Notion을 확인한다 (Notion MCP `notion-search` / `notion-fetch`).

- **「GreenStep - 사회적 가치 전환 플랫폼」** — 기획서 원본 (서비스 개요, 사용자, 화면, SROI 산정)
- **「GreenStep_기술_아키텍처」** — 하위 페이지. 1번 「회원·기관 DB」 표 + ERD 이미지가 DB의 기준. API 설계(FastAPI `/api/v1`), 인증 방식
- 노션의 옛 명칭(ESG 이력서, CSR 보고서)은 아래 "명칭"대로 바꿔 쓴다.

## 작업 규칙 (사용자 지시 — 반드시 지킬 것)

1. **작업은 `src/` 폴더 안에서만 한다.** (이 CLAUDE.md도 `src/CLAUDE.md`로 레포에 포함)
2. 백엔드·DB·워커 구현 **허용** (예전의 "백엔드 구현 금지" 규칙은 폐기됨). 단 프론트 `Api` 인터페이스 + mock 구현은 계속 유지한다.
3. **디자인은 원본 시안 그대로** — `src/GreenStep_mokup.html` (파랑 `#256ef4`, KRDS풍). 새 요소도 원본 CSS 클래스·토큰(`web/src/styles/original.css`)으로 만든다.
4. 요구사항 질문은 **AskUserQuestion 선택창** 형식으로 한다.
5. 커밋/푸시는 요청 있을 때만. 커밋 작성자는 레포 로컬 설정(`2YoonJae` + GitHub noreply 이메일)을 쓴다. 개인 이메일을 커밋에 넣지 않는다.
6. 이미 확정된 결정(아래)은 다시 묻지 않는다. 보류 항목만 새로 확인한다.
7. **비밀값은 절대 출력·커밋하지 않는다** — `src/api/.env`(1365 인증키). 공개 레포이므로 커밋 전 `git status`로 `.env`·덤프·개인정보 파일이 없는지 확인한다.
8. 디자인 참고 파일(`src/ESG_보고서_*.pdf`, `GreenStep_mokup.html`, `청년 보고서.html`)은 `.git/info/exclude`로 **공개 레포에서 제외**했다. 연락처 등 개인정보가 들어 있을 수 있으므로 사용자 허락 없이 올리지 않는다.

## 명칭 (확정)

| 대상 | 쓰는 이름 | 쓰지 않는 이름 |
| --- | --- | --- |
| 청년 산출물 | **봉사 이력서** | ESG 이력서, 봉사 가치 이력서 |
| 기관 산출물 | **ESG 경영 보고서** | CSR 보고서 |
| 포털 | **Green청년** / **Green기관** | 기관 서비스 메뉴 |

## 폴더 구조

```
esg/
├─ doc/ · img/                 # 기획 자료, 로고 원본(img/GreenStep_Label.png) — 레포 밖
└─ src/                        # ← Git 레포
   ├─ CLAUDE.md
   ├─ README.md
   ├─ docker-compose.yml       # web · backend · db · worker
   ├─ .gitignore               # .env, 덤프(*backup*.sql), api/data/, node_modules, dist …
   ├─ nginx/nginx.conf         # SPA try_files + /api/ → backend:8000 (resolver 127.0.0.11)
   ├─ api/                     # 1365 수집 워커: greenstep_collector.py, .env(비밀), .env.example, Dockerfile
   │                           #   data/*.json 은 옛 파일 수집 방식의 잔재(미사용, git 제외)
   ├─ backend/                 # FastAPI + SQLAlchemy 2 + Alembic + psycopg3 + argon2 + PyJWT
   │  ├─ alembic/versions/     # 0001 스키마(.sql 원본+.py), 0002 수집 테이블, 0003 image_url 삭제
   │  └─ app/                  # main, config, db, models, schemas(camelCase), security, domain, deps, seed
   │     └─ routers/           # auth, org, public
   └─ web/                     # React 18.3 + TS 5.6 + Vite 6 + Tailwind 4.1 + react-router 6
      ├─ public/brand/         # greenstep-mark.png(로고), favicon.png, apple-touch-icon.png
      ├─ public/images/        # 배너 사진 hero/education/care.png (animals·digital·environment·food.jpg는 미사용)
      └─ src/
         ├─ api/               # types.ts(Api 인터페이스), endpoints.ts, http/, mock/, index.ts(모드 전환)
         ├─ data/              # types.ts(테이블 형태 타입), seed.ts(mock 전용)
         ├─ lib/               # sroi, difficulty, aggregate, menu(포털·메뉴), auth, theme, csv …
         ├─ components/        # Layout(포털 탭·유틸바·메가메뉴), HeroBanner, SubPage, Guards, ui
         ├─ pages/             # Home, Activities, ActivityDetail, Support, Verify, Login, Signup
         │  ├─ youth/          # MyPage, Records, RecordNew, Resume
         │  └─ org/            # Dashboard, OrgActivities, ActivityForm, Reports(ESG 경영 보고서)
         └─ styles/            # index.css, original.css
```

## 실행

- Docker (기본): `cd src && docker compose up -d --build`
  - 웹 http://localhost:8080 (`WEB_PORT`), API 문서 http://localhost:8080/api/v1/docs
  - DB 호스트 포트 `127.0.0.1:5433` (`DB_PORT`). 이 PC에는 별도의 Windows PostgreSQL 19 서비스가 5432를 쓰고 있어 5433으로 피했다 (건드리지 않음).
  - `api/.env`가 없으면 compose 전체가 실패한다 (`env_file` 필수). 다른 PC에서는 `copy api\.env.example api\.env` 후 Decoding 키 입력. → `required: false`로 바꾸자는 제안이 미결정 상태.
- 웹만 개발: `cd src/web && npm install && npm run dev` (http://localhost:5173)
- API 모드 `VITE_API_MODE`: Docker 빌드 기본 **http**(DB 사용), `web/.env.example`·로컬 dev 기본 **mock**
  - mock: localStorage `greenstep-demo-v4`, 세션 `greenstep-session-v1`, 푸터 "데모 데이터 초기화"
  - http에서 서버 미구현 기능(신청·활동 기록·이력서·보고서)은 501 "구현되지 않았습니다", 공지·FAQ는 빈 목록
- DB 직접 보기: `docker exec -it greenstep-db psql -U greenstep` 또는 DB 도구 `localhost:5433` (user/pw/db 모두 `greenstep`)
- DB 초기화: `docker compose down -v` (데이터 전부 삭제 — 사용자 확인 필요)
- 데모 계정 (비밀번호 `demo1234`): 청년 `youth@demo.kr` → `/login`, 기관 `org@demo.kr` → `/org/login`. http 모드는 `DEMO_MODE=true`일 때 사용자가 없으면 시드.

## DB (PostgreSQL 19, Docker `postgres:19`)

- 볼륨은 PG18+ 방식 `pgdata:/var/lib/postgresql` (볼륨명 `src_pgdata`).
- 노션 11개 테이블: users, organizations, org_members, activities, applications, participations, evidence_documents, verification_logs, record_attributions, valuation_rules, social_value_calculations
- 확장 1:1 테이블 (사용자가 "확장 테이블로 분리" 선택): user_profiles, organization_profiles, activity_details
- 수집용: sync_runs, external_sync_state
- 노션과 다르게 정한 점 (ERD 기준): `business_no` 숫자 10자리 VARCHAR(10), `businiess_api_key`·`org_members.password_hash` 없음, DATETIME → TIMESTAMPTZ, 상태값은 영문 코드 + CHECK
- 기관 유형은 노션 예시 기준. 공고 상태: `DRAFT` / `RECRUITING` / `CLOSED` / `CANCELLED`. 출처 `source_type`: `GREENSTEP` / `1365`
- 스키마 변경은 새 Alembic 마이그레이션으로 (기존 0001~0003 수정 금지). backend 컨테이너가 시작 시 `alembic upgrade head` 실행.

## 백엔드 · 인증

- 라우터: `/auth/*`(청년·기관 가입/로그인, refresh, logout), `PATCH /me`, `/org/*`(me, dashboard, activities CRUD·상태, demo/approve-review), 공개 `/activities`, `/activities/{id}`, `/stats`, `/notices`, `/faqs`
- access JWT는 응답 본문 → 웹은 메모리 보관, refresh JWT는 httpOnly 쿠키 `gs_refresh` (path `/api/v1/auth`)
- 역할 YOUTH / ORG. 기관은 `verification_status=APPROVED`여야 공고 등록. 데모 승인 버튼은 `DEMO_MODE`일 때만.
- 가중치는 서버가 판정 (CANDIDATE만, 운영자 확인 전 1.0). 난이도 키워드: `backend/app/domain.py` ↔ `web/src/lib/difficulty.ts` 동기 유지.
- `JWT_SECRET`, DB 비밀번호 기본값은 로컬 개발용.

## 1365 봉사 공고 수집 워커 (`src/api/`)

- 공공데이터포털 15157582 「행정안전부_봉사참여정보서비스_GW」 `https://apis.data.go.kr/1741000/volunteerPartcptnService` (getVltrAreaList, getVltrPartcptnItem)
- **2시간마다** (`INTERVAL_SECONDS=7200`) 수집 → `activities`(source_type='1365') + `activity_details`. 웹은 우리 DB만 읽는다.
- 지역 `REGIONS`: 안양시·서초구·대구 남구 × `REGION_LIMIT`. 상세조회 하루 `DETAIL_DAILY_BUDGET=900`, `DETAIL_REFRESH_HOURS=6`
- `progrmSttusSe` 1/2/3 → DRAFT/RECRUITING/CLOSED, 마감일 지나면 CLOSED. `ADULT_ONLY=true`(청소년 전용 제외)
- 담당자 이름·연락처 저장 안 함, 설명문 속 전화·메일 마스킹. 출처 표기 필수, 신청은 1365 원문 링크로.
- Encoding/Decoding 키 혼동 시 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` → Decoding 키 사용
- 한 번 수집: `docker compose run --rm -e RUN_MODE=once worker`. 실행 기록: `sync_runs`

## 도메인 규칙

- **SROI = 활동 시간 × 표준 단가 × 기관 가중치**
  - 단가: 2026 최저임금 10,320원, 돌봄·보육 11,120원
  - 가중치 1.0~1.5. 신규 활동은 난이도 가중치 **자동 후보만 표시, 운영자 확인 전엔 1.0**
  - 단가·가중치는 **기록 제출 시점 스냅샷**으로 고정
- 집계·이력서·보고서에는 **기관 승인(APPROVED) 기록만** 반영
- 1365 확인서 기록은 `EXTERNAL_PENDING`(검증 대기)
- **기관 ESG 등급은 매기지 않는다** (등급 표시 제거됨)
- 봉사 이력서: A4, 확인번호, `/verify`에서 진위 조회
- ESG 경영 보고서: 미리보기(워터마크) → "결제 완료"(데모) → 발행, 확인번호 `GS-YYYY-xxxx-XXXX` → `/verify`. 발행 후 수정 = 새 버전
- AI 초안: 인사말·기관소개만, 섹션당 3회 (placeholder, 모델 미정)
- 기관 가입 → 운영자 **심사 대기** (데모 승인 버튼). 운영자 화면은 범위 제외

## 확정된 UI 결정

- **포털 분리**: 유틸바 왼쪽에 1365자원봉사포털/기부포털 같은 탭 `Green청년` / `Green기관`. 포털은 경로로 판정(`lib/menu.ts` `portalOfPath`), 공통 화면은 직전 포털 유지(sessionStorage `greenstep-portal`)
  - Green청년 메뉴: 봉사활동 찾기 · 봉사 이력서 · 고객지원
  - Green기관 메뉴: 기관 대시보드 · 활동 관리 · ESG 경영 보고서 · 고객지원
  - Green기관 탭: 로그인 안 했으면 `/org/login`, 기관 로그인 상태면 `/org`
- **로그인 페이지 분리**: 청년 `/login`, 기관 `/org/login` (전환 탭 없음). `/org/login`에서는 상단 메뉴·메가메뉴를 숨김. 옛 주소 `/login?type=org`는 `/org/login`으로 리다이렉트. 회원가입은 `/signup`, `/signup?type=org` (탭 유지)
- **로고**: `public/brand/greenstep-mark.png` + "GreenStep", 클릭 시 홈(홈이면 맨 위로). 파비콘도 같은 라벨 이미지
  - 로고 아래 문구: 청년 포털 "청년의 실천을, 사회적 가치로", 기관 포털 **"기관의 실천을 ESG경영으로"**
- **유틸바 오른쪽**: 다크모드 스위치(로그인 왼쪽) · 로그인 · 회원가입 (유틸바의 "기관 로그인" 링크는 제거). 로그인 후 `김지원님 · 마이페이지`(청년 → `/me`), `담당자명님 · 마이페이지`(기관 → `/org`)
- 마이페이지는 봉사 이력서 메뉴에서 제거, 유틸바에서만 진입
- 메가메뉴: hover 시 하위 메뉴 열이 각 메뉴 바로 아래 정렬. 메가메뉴 안의 "청년/기관 회원 전용" 라벨 제거
- 메인 배너: 폭은 메뉴와 같은 **1200px 컨테이너**, 3장 자동 전환, 검색 영역과 겹치지 않음
- **사진 기능 전체 제거**: 공고 목록·상세·등록 폼에 사진 없음 (배너 사진만 유지)
- **채용정보 메뉴·기능 제거**, 채용 공고 ↔ 이력서 연동 없음 (채용 API 계획 폐기)
- 기관 공고 등록 폼 필드는 `activities` / `activity_details` 컬럼과 1:1
- 활동 목록에 `GreenStep 공고` / `1365 공고` 탭, 1365 상세는 출처 표기 + 원문 신청 링크
- 다크모드 `<html data-theme>`, localStorage `greenstep-theme`. 문서(이력서·보고서)는 항상 라이트
- 글자·화면 설정 기능 제거. 컨테이너 폭 1200px, 카드 제목 2줄

## 앞으로의 방향 (다음 단계 후보)

- http 모드 서버 구현: 활동 신청(applications) → 활동 기록 제출·승인(participations, verification_logs, social_value_calculations) → 봉사 이력서 → ESG 경영 보고서 → 공지·FAQ
- 1365 분야 분류 키워드 개선 (현재 대부분 "생활·환경"으로 쏠림)
- compose 워커 `env_file`을 `required: false`로 (`.env` 없어도 웹·DB 기동)
- 미사용 배너 사진 정리, 다크모드용 로고 변형

## 보류 항목 (결정 필요 시 사용자에게 확인)

- 가중치 기준: 모집 부족 / 취약 지역
- ESG 경영 보고서 가격
- AI 초안 모델
- 1365 확인서 검증 주체
