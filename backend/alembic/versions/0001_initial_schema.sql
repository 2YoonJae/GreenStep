-- ============================================================================
-- GreenStep 내부 DB 스키마 · PostgreSQL 19
-- 기준: 노션 「GreenStep_기술_아키텍처」 > 1. 회원·기관 DB (표 + ERD 사진)
--
--   A. 노션 테이블 11개  — 컬럼 이름·순서·타입을 노션 표 / ERD 그대로 따름
--   B. 확장 테이블 3개   — 노션 표에 없지만 기존 웹 기능(SROI·난이도 가중치·이력서)에
--                          필요한 항목. 핵심 테이블과 1:1 로 분리 저장
--
-- 노션 표와 다르게 정한 부분 (ERD 사진 기준으로 정리)
--   · organizations.business_no : 표는 UUID, ERD 는 varchar → 사업자등록번호 10자리 VARCHAR(10)
--   · organizations.businiess_api_key : ERD 에 없음 → 만들지 않음
--   · org_members.password_hash : ERD 에 없음 → 비밀번호는 users 에만 저장
--   · DATETIME → TIMESTAMPTZ (PostgreSQL 에는 DATETIME 타입이 없음)
--   · 상태값 컬럼은 영문 코드로 저장하고 CHECK 제약으로 허용값을 고정 (화면에서 한글로 표시)
-- ============================================================================

-- updated_at 자동 갱신
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;


-- ============================================================================
-- A. 노션 테이블
-- ============================================================================

-- USERS (회원정보) ─ 청년 회원과 기관 담당자 모두 이 테이블에 계정을 가짐
CREATE TABLE users (
    user_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email          VARCHAR(255) NOT NULL UNIQUE,              -- 로그인 이메일 (소문자로 저장)
    password_hash  VARCHAR(255) NOT NULL,                     -- argon2 해시
    name           VARCHAR(100) NOT NULL,
    account_status VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                   CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'WITHDRAWN')),  -- 활성 / 정지 / 탈퇴
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ORGANIZATIONS (기관정보)
CREATE TABLE organizations (
    organization_id     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    organization_type   VARCHAR(50)  NOT NULL
                        CHECK (organization_type IN (
                            'WELFARE_CENTER',    -- 종합사회복지관
                            'WELFARE_FACILITY',  -- 복지시설
                            'NONPROFIT',         -- 비영리단체
                            'PUBLIC',            -- 공공기관
                            'COMPANY',           -- 기업
                            'OTHER'              -- 기타
                        )),
    verification_status VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                        CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),  -- 심사 대기 / 승인 / 반려
    address             VARCHAR(255) NOT NULL,
    contact_email       VARCHAR(255) NOT NULL,                -- 기관 공식 이메일
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    business_no         VARCHAR(10)  NOT NULL UNIQUE          -- 사업자등록번호 숫자 10자리
                        CHECK (business_no ~ '^[0-9]{10}$')
);


-- ORG_MEMBERS (기관 소속 회원) ─ USERS ↔ ORGANIZATIONS 연결 (belongs_to / has)
CREATE TABLE org_members (
    member_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    organization_id   UUID        NOT NULL REFERENCES organizations (organization_id) ON DELETE CASCADE,
    role              VARCHAR(30) NOT NULL DEFAULT 'MANAGER'
                      CHECK (role IN ('OWNER', 'MANAGER')),                       -- 기관 관리자 / 담당자
    membership_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                      CHECK (membership_status IN ('PENDING', 'ACTIVE', 'REMOVED')),  -- 승인 대기 / 활성 / 해제
    joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, organization_id)
);
CREATE INDEX org_members_organization_idx ON org_members (organization_id);


-- ACTIVITIES (봉사활동 공고) ─ ORGANIZATIONS 가 게시 (publishes). 1365 등 외부 공고는 organization_id NULL
CREATE TABLE activities (
    activity_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID         REFERENCES organizations (organization_id) ON DELETE RESTRICT,
    source_type          VARCHAR(20)  NOT NULL DEFAULT 'GREENSTEP'
                         CHECK (source_type IN ('GREENSTEP', '1365')),
    external_activity_id VARCHAR(100),                        -- 1365 등 외부 API 공고 고유번호
    external_url         TEXT,                                -- 외부 공고·신청 페이지
    external_org_name    VARCHAR(200),                        -- 외부 공고의 모집기관명
    title                VARCHAR(255) NOT NULL,
    description          TEXT         NOT NULL DEFAULT '',
    category             VARCHAR(100) NOT NULL
                         CHECK (category IN ('education', 'care', 'environment', 'health')),  -- GreenStep 표준 분야
    source_category      VARCHAR(100),                        -- 외부 API 원본 분야
    region_code          VARCHAR(20),                         -- 시·도 행정구역 코드 (예: 11 서울)
    region_name          VARCHAR(100),                        -- 지역명 (예: 서울 마포구)
    address              VARCHAR(255),                        -- 실제 봉사 장소
    recruit_start_date   DATE,
    recruit_end_date     DATE,
    activity_start_date  DATE,
    activity_end_date    DATE,
    capacity             INTEGER      CHECK (capacity >= 0),
    applicant_count      INTEGER      NOT NULL DEFAULT 0 CHECK (applicant_count >= 0),
    status               VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                         CHECK (status IN ('DRAFT', 'RECRUITING', 'CLOSED', 'CANCELLED')),  -- 임시저장 / 모집 중 / 마감 / 취소
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT activities_source_ck CHECK (
        (source_type = 'GREENSTEP' AND organization_id IS NOT NULL)
        OR (source_type <> 'GREENSTEP' AND external_activity_id IS NOT NULL)
    ),
    CONSTRAINT activities_recruit_period_ck  CHECK (recruit_start_date  <= recruit_end_date),
    CONSTRAINT activities_activity_period_ck CHECK (activity_start_date <= activity_end_date),
    CONSTRAINT activities_external_uk UNIQUE (source_type, external_activity_id)
);
CREATE INDEX activities_organization_idx ON activities (organization_id);
CREATE INDEX activities_status_idx       ON activities (status, recruit_end_date);
CREATE TRIGGER activities_updated_at BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- APPLICATIONS (봉사활동 신청) ─ USERS 가 제출 (submits), ACTIVITIES 가 받음 (receives)
CREATE TABLE applications (
    application_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    activity_id    UUID        NOT NULL REFERENCES activities (activity_id) ON DELETE CASCADE,
    status         VARCHAR(20) NOT NULL DEFAULT 'APPLIED'
                   CHECK (status IN ('APPLIED', 'APPROVED', 'REJECTED', 'CANCELLED')),
    applied_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at   TIMESTAMPTZ,                               -- 기관 처리 일시
    UNIQUE (user_id, activity_id)
);
CREATE INDEX applications_activity_idx ON applications (activity_id);


-- PARTICIPATIONS (봉사활동 실적) ─ USERS 기록 (records), APPLICATIONS → (leads_to), ACTIVITIES (relates_to)
CREATE TABLE participations (
    participation_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    activity_id         UUID        REFERENCES activities (activity_id) ON DELETE SET NULL,
    application_id      UUID        REFERENCES applications (application_id) ON DELETE SET NULL,
    started_at          TIMESTAMPTZ NOT NULL,
    ended_at            TIMESTAMPTZ NOT NULL,
    approved_minutes    INTEGER     CHECK (approved_minutes >= 0),   -- 승인된 봉사시간(분)
    record_source       VARCHAR(30) NOT NULL DEFAULT 'GREENSTEP'
                        CHECK (record_source IN ('GREENSTEP', '1365', 'VMS', 'DOVOL')),
    status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED')),  -- 작성 / 제출(승인 대기) / 승인 / 반려
    verification_method VARCHAR(30)
                        CHECK (verification_method IN ('ORG_APPROVAL', 'OFFICIAL_API', 'OFFICIAL_SITE', 'MANUAL')),
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FAILED')),  -- 검증 대기 / 완료 / 실패
    approved_at         TIMESTAMPTZ,
    CONSTRAINT participations_period_ck CHECK (started_at < ended_at)
);
CREATE INDEX participations_user_idx     ON participations (user_id);
CREATE INDEX participations_activity_idx ON participations (activity_id);


-- EVIDENCE_DOCUMENTS (실적 증빙서류) ─ PARTICIPATIONS 1:N (has)
CREATE TABLE evidence_documents (
    document_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    participation_id    UUID        NOT NULL REFERENCES participations (participation_id) ON DELETE CASCADE,
    document_type       VARCHAR(50) NOT NULL
                        CHECK (document_type IN ('1365_CERT', 'VMS_CERT', 'DOVOL_CERT', 'OTHER')),
    private_storage_key TEXT        NOT NULL,                 -- 비공개 저장소 경로 (공개 URL 아님)
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX evidence_documents_participation_idx ON evidence_documents (participation_id);


-- VERIFICATION_LOGS (실적 검증 이력) ─ PARTICIPATIONS 1:N (verified_by)
CREATE TABLE verification_logs (
    verification_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    participation_id UUID        NOT NULL REFERENCES participations (participation_id) ON DELETE CASCADE,
    verifier_type    VARCHAR(30) NOT NULL
                     CHECK (verifier_type IN ('API', 'ORG_MANAGER', 'MANUAL')),
    result           VARCHAR(30) NOT NULL
                     CHECK (result IN ('SUCCESS', 'FAILED', 'UNVERIFIABLE')),  -- 성공 / 실패 / 확인 불가
    verified_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX verification_logs_participation_idx ON verification_logs (participation_id);


-- RECORD_ATTRIBUTIONS (봉사실적의 기관 귀속) ─ PARTICIPATIONS (assigned_to), ORGANIZATIONS (validates)
CREATE TABLE record_attributions (
    attribution_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    participation_id   UUID        NOT NULL REFERENCES participations (participation_id) ON DELETE CASCADE,
    organization_id    UUID        NOT NULL REFERENCES organizations (organization_id) ON DELETE CASCADE,
    attribution_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                       CHECK (attribution_status IN ('PENDING', 'APPROVED', 'REJECTED')),  -- 확인 대기 / 승인 / 반려
    attribution_basis  VARCHAR(50),                           -- 주관기관 확인, 담당자 승인 등
    confirmed_at       TIMESTAMPTZ,
    UNIQUE (participation_id, organization_id)
);
CREATE INDEX record_attributions_organization_idx ON record_attributions (organization_id);


-- VALUATION_RULES (사회적 가치 산정 기준)
CREATE TABLE valuation_rules (
    rule_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    version        VARCHAR(30)  NOT NULL UNIQUE,
    maximum_weight DECIMAL(4,2) NOT NULL CHECK (maximum_weight >= 1.00)
);


-- SOCIAL_VALUE_CALCULATIONS (사회적 가치 계산 결과) ─ PARTICIPATIONS (calculated_as), VALUATION_RULES (applies)
-- 단가·가중치는 계산 시점 스냅샷으로 고정
CREATE TABLE social_value_calculations (
    calculation_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    participation_id     UUID          NOT NULL REFERENCES participations (participation_id) ON DELETE CASCADE,
    rule_id              UUID          NOT NULL REFERENCES valuation_rules (rule_id) ON DELETE RESTRICT,
    hourly_rate_snapshot DECIMAL(12,2) NOT NULL CHECK (hourly_rate_snapshot > 0),
    weight_snapshot      DECIMAL(4,2)  NOT NULL CHECK (weight_snapshot BETWEEN 1.00 AND 1.50),
    estimated_value_krw  DECIMAL(15,2) NOT NULL CHECK (estimated_value_krw >= 0),
    calculated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX social_value_calculations_participation_idx ON social_value_calculations (participation_id);


-- ============================================================================
-- B. 확장 테이블 (노션 표에 없음 · 핵심 테이블과 1:1)
-- ============================================================================

-- USER_PROFILES ─ 청년 회원 추가 정보 (ESG 이력서 표시용). 이 행이 있으면 청년 회원
CREATE TABLE user_profiles (
    user_id           UUID         PRIMARY KEY REFERENCES users (user_id) ON DELETE CASCADE,
    school            VARCHAR(200) NOT NULL DEFAULT '',       -- 학교·전공
    target_field      VARCHAR(50)  NOT NULL DEFAULT '',       -- 희망 분야
    marketing_consent BOOLEAN      NOT NULL DEFAULT false,
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ORGANIZATION_PROFILES ─ 기관 소개(CSR 보고서 초안용) + 운영자 전용 가중치 플래그
CREATE TABLE organization_profiles (
    organization_id   UUID    PRIMARY KEY REFERENCES organizations (organization_id) ON DELETE CASCADE,
    intro             TEXT    NOT NULL DEFAULT '',
    weight_shortage   BOOLEAN NOT NULL DEFAULT false,         -- 모집 부족 (기준 보류)
    weight_difficulty BOOLEAN NOT NULL DEFAULT false,         -- 직무 난이도
    weight_vulnerable BOOLEAN NOT NULL DEFAULT false          -- 취약 지역 (기준 보류)
);


-- ACTIVITY_DETAILS ─ 공고의 SROI 계산·난이도 가중치 판단 정보
-- weight 는 서버가 결정. 기관 입력으로는 후보(CANDIDATE)만 표시, 운영자 확인(CONFIRMED) 전엔 1.0
CREATE TABLE activity_details (
    activity_id        UUID         PRIMARY KEY REFERENCES activities (activity_id) ON DELETE CASCADE,
    summary            VARCHAR(80)  NOT NULL DEFAULT '',      -- 한 줄 소개
    hours_per_session  DECIMAL(3,1) NOT NULL CHECK (hours_per_session BETWEEN 0.5 AND 12),
    target_group       VARCHAR(100) NOT NULL DEFAULT '',      -- 대상자
    tasks              VARCHAR(200) NOT NULL DEFAULT '',      -- 수행 업무
    individual_support BOOLEAN      NOT NULL DEFAULT false,   -- 1:1 개별 지원
    image_url          TEXT,
    difficulty_reason  TEXT,                                  -- 자동 분류 근거
    weight             DECIMAL(2,1) NOT NULL DEFAULT 1.0 CHECK (weight BETWEEN 1.0 AND 1.5),
    weight_status      VARCHAR(20)  NOT NULL DEFAULT 'NONE'
                       CHECK (weight_status IN ('NONE', 'CANDIDATE', 'CONFIRMED')),
    weight_difficulty  BOOLEAN      NOT NULL DEFAULT false,
    weight_shortage    BOOLEAN      NOT NULL DEFAULT false,
    weight_vulnerable  BOOLEAN      NOT NULL DEFAULT false,
    view_count         INTEGER      NOT NULL DEFAULT 0 CHECK (view_count >= 0)
);


-- ============================================================================
-- 기준 데이터
-- ============================================================================
-- 2026 산정 기준: 기본 단가 10,320원(최저임금) · 돌봄·보육 11,120원 · 가중치 1.0~1.5
INSERT INTO valuation_rules (version, maximum_weight) VALUES ('2026.1', 1.50);
