-- ============================================================================
-- 수집 워커(src/api/greenstep_collector.py) 전용 테이블
-- 공고 자체는 기존 activities(source_type='1365') + activity_details 에 저장합니다.
-- ============================================================================

-- SYNC_RUNS ─ 수집 실행 기록 (노션 「GreenStep_기술_아키텍처」 수집 흐름 5번)
-- 수집이 실패해도 기존 공고는 그대로 보이고, 실패 사유만 여기에 남습니다.
CREATE TABLE sync_runs (
    sync_run_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source          VARCHAR(20) NOT NULL,                     -- 1365
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    fetched         INTEGER     NOT NULL DEFAULT 0,           -- 목록에서 확인한 고유 공고 수
    inserted        INTEGER     NOT NULL DEFAULT 0,
    updated         INTEGER     NOT NULL DEFAULT 0,
    closed          INTEGER     NOT NULL DEFAULT 0,           -- 마감 처리한 공고 수
    skipped         INTEGER     NOT NULL DEFAULT 0,           -- 청년 참여 불가·데이터 오류로 건너뛴 수
    detail_requests INTEGER     NOT NULL DEFAULT 0,           -- 상세조회 API 호출 수 (일일 한도 계산)
    error           TEXT                                      -- 실패 사유 (인증키 등 비밀값은 기록하지 않음)
);
CREATE INDEX sync_runs_source_idx ON sync_runs (source, started_at DESC);


-- EXTERNAL_SYNC_STATE ─ 외부 공고별 마지막 상세조회 시각
-- 상세조회는 하루 호출 한도가 있어, 최근에 조회한 공고는 다시 부르지 않습니다.
CREATE TABLE external_sync_state (
    source_type          VARCHAR(20)  NOT NULL,
    external_activity_id VARCHAR(100) NOT NULL,
    source_status_code   VARCHAR(10),                         -- 1365 progrmSttusSe (1 모집대기 · 2 모집중 · 3 모집완료)
    last_detail_at       TIMESTAMPTZ,
    PRIMARY KEY (source_type, external_activity_id)
);
