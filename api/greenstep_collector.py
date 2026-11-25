"""GreenStep 1365 봉사 공고 수집 워커

공공데이터포털 「행정안전부_봉사참여정보서비스_GW」 → PostgreSQL(activities + activity_details)
  1. 지역별 목록(getVltrAreaList)에서 최신 공고를 고르고
  2. 상세(getVltrPartcptnItem)로 모집 상태·인원·활동 시간을 채운 뒤
  3. GreenStep 테이블 모양으로 바꿔 DB에 저장(있으면 갱신)하고
  4. 모집 기간이 지난 공고는 마감 처리합니다.
RUN_MODE=loop 이면 INTERVAL_SECONDS(기본 7200초 = 2시간)마다 반복합니다.

원칙 (CLAUDE.md · 노션 기술 아키텍처)
  · 인증키는 이 워커(서버)에만 둡니다. 웹은 우리 DB 만 읽습니다.
  · 담당자 이름·전화·이메일 필드는 저장하지 않고, 설명문 속 연락처는 가립니다.
  · 신청은 1365 원문 링크(external_url)로 보냅니다. 화면에 출처를 표기합니다.
"""
import getpass
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
import xml.etree.ElementTree as ET

import psycopg
import requests

SETTING_NAMES = {
    'SERVICE_KEY', 'REGION_LIMIT', 'RUN_MODE', 'INTERVAL_SECONDS', 'DETAIL_DAILY_BUDGET',
    'REQUEST_DELAY_SECONDS', 'DATA_DIR', 'DATABASE_URL', 'DETAIL_REFRESH_HOURS', 'ADULT_ONLY',
}


def load_settings():
    """같은 폴더의 .env 를 읽습니다 (Docker 에서는 docker-compose 의 env_file 로 주입되어 파일이 없음)."""
    path = Path(__file__).resolve().parent / '.env'
    if not path.exists():
        return
    for number, line in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        name, sep, setting = line.partition('=')
        name = name.strip()
        if not sep or name not in SETTING_NAMES:
            raise SystemExit(f'.env 설정 오류: {number}번째 줄')
        os.environ.setdefault(name, setting.strip())


load_settings()

KST = timezone(timedelta(hours=9))
BASE_URL = 'https://apis.data.go.kr/1741000/volunteerPartcptnService'
REGIONS = {
    '경기도 안양시': {'sido': '6410000', 'sigungu': '3830000'},
    '서울특별시 서초구': {'sido': '6110000', 'sigungu': '3210000'},
    '대구광역시 남구': {'sido': '6270000', 'sigungu': '3440000'},
}
REGION_LIMIT = int(os.getenv('REGION_LIMIT', '1'))  # test: 1; production: 20
LIST_PAGE_SIZE = 100
RUN_MODE = os.getenv('RUN_MODE', 'once').lower()  # once / loop
INTERVAL_SECONDS = int(os.getenv('INTERVAL_SECONDS', '7200'))
DETAIL_DAILY_BUDGET = int(os.getenv('DETAIL_DAILY_BUDGET', '900'))
# 최근 N시간 안에 상세조회한 공고는 다시 부르지 않음 (일일 호출 한도 절약)
DETAIL_REFRESH_HOURS = float(os.getenv('DETAIL_REFRESH_HOURS', '6'))
REQUEST_DELAY_SECONDS = float(os.getenv('REQUEST_DELAY_SECONDS', '0.3'))
# 성인 참여 불가(청소년 전용) 공고는 저장하지 않음 — GreenStep 대상은 대학생·취업 준비 청년
ADULT_ONLY = os.getenv('ADULT_ONLY', 'true').strip().lower() in ('1', 'true', 'yes', 'on')
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://greenstep:greenstep@localhost:5433/greenstep')

# 1365 시·도 코드(행정표준코드) → GreenStep 시·도 코드 (activities.region_code · 웹 지역 필터와 같은 값)
SIDO_TO_REGION_CODE = {
    '6110000': '11', '6260000': '26', '6270000': '27', '6280000': '28', '6290000': '29', '6300000': '30',
    '6310000': '31', '5690000': '36', '6410000': '41', '6530000': '51', '6420000': '51', '6430000': '43',
    '6440000': '44', '6540000': '52', '6450000': '52', '6460000': '46', '6470000': '47', '6480000': '48',
    '6500000': '50',
}
# 수집기 세부 분류 → GreenStep 표준 분야 4개 (activities.category CHECK 제약과 같은 값)
#   '생활·환경'(environment)의 단가 기준이 '일반·행정·환경' 이라 행정·기타도 여기에 묶음
CATEGORY_TO_GREENSTEP = {
    'education': 'education', 'it': 'education', 'care': 'care', 'healthcare': 'health',
    'environment': 'environment', 'administration': 'environment', 'general': 'environment',
}
DEFAULT_HOURS = 2.0  # 상세에 활동 시간이 없을 때 회당 시간 기본값


def now():
    return datetime.now(KST)


def timestamp():
    return now().isoformat(timespec='seconds')


def today():
    return now().date()


def log(message=''):
    print(message, flush=True)


# ───────── 응답 값 변환 ─────────


def value(item, name):
    v = item.findtext(name)
    return v.strip() if v and v.strip() else None


def date_value(s):
    if not s:
        return None
    try:
        return datetime.strptime(s, '%Y%m%d').date()
    except ValueError:
        return None


def int_value(s):
    try:
        return int(s) if s not in (None, '') else None
    except ValueError:
        return None


def hours_value(begin, end):
    """actBeginTm·actEndTm(시 단위) → 회당 활동 시간 (0.5~12)"""
    b, e = int_value(begin), int_value(end)
    if b is None or e is None or e <= b:
        return None
    return float(min(12, max(0.5, e - b)))


PHONE = re.compile(r'(?<!\d)0\d{1,2}[\s.\-)]*\d{3,4}[\s.\-]*\d{4}(?!\d)')
EMAIL = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')


def mask_contacts(text):
    """설명문 속 개인 연락처(전화·이메일)를 가림. 원문은 1365 링크에서 확인"""
    if not text:
        return text
    text = PHONE.sub('(연락처는 1365 원문 참고)', text)
    return EMAIL.sub('(이메일은 1365 원문 참고)', text)


def request_xml(session, endpoint, params):
    try:
        response = session.get(f'{BASE_URL}/{endpoint}', params=params, timeout=25)
        if response.status_code != 200:
            log(f'  HTTP 오류: {response.status_code}')
            return None
        root = ET.fromstring(response.content)
        code = root.findtext('./header/resultCode')
        if code != '00':
            log(f'  API 결과 오류: {code} / {root.findtext("./header/resultMsg")}')
            return None
        return root
    except (requests.RequestException, ET.ParseError) as exc:
        # Never print exception text: requests exceptions may contain the secret key in a URL.
        log(f'  API 요청/응답 오류: {type(exc).__name__}')
        return None


# ───────── 1365 API ─────────


def fetch_list(session, key, region, codes):
    all_items = []
    page = 1

    # 1. 지역별 전체 공고 목록 조회
    while True:
        root = request_xml(session, 'getVltrAreaList', {
            'serviceKey': key,
            'pageNo': page,
            'numOfRows': LIST_PAGE_SIZE,
            'schSido': codes['sido'],
            'schSign1': codes['sigungu'],
        })
        if root is None:
            return None
        items = root.findall('./body/items/item')
        total_count = int_value(root.findtext('./body/totalCount'))
        if not items:
            break
        all_items.extend(items)
        log(f'  {page}페이지: {len(items)}개 조회')
        if total_count is not None and len(all_items) >= total_count:
            break
        page += 1
        time.sleep(REQUEST_DELAY_SECONDS)

    # 2. 유효한 공고번호만 남기고 중복 제거
    unique_items = {}
    for item in all_items:
        external_id = value(item, 'progrmRegistNo')
        if external_id and external_id.isdigit():
            unique_items[external_id] = item

    # 3. 프로그램 등록번호 내림차순(최신순) → 4. 상위 REGION_LIMIT 개
    sorted_items = sorted(unique_items.values(), key=lambda item: int(value(item, 'progrmRegistNo')), reverse=True)
    items = sorted_items[:REGION_LIMIT]
    log(f'  전체 후보 공고: {len(unique_items)}개 / 최종 선택: {len(items)}개')

    # 5. ACTIVITIES 형식으로 변환
    results = []
    for item in items:
        external_id = value(item, 'progrmRegistNo')
        results.append({
            'external_activity_id': external_id,
            'external_url': 'https://www.1365.go.kr/vols/1572247904127/partcptn/timeCptn.do?type=show&progrmRegistNo=' + external_id,
            'external_org_name': value(item, 'nanmmbyNm'),
            'title': value(item, 'progrmSj'),
            'source_category': value(item, 'srvcClCode'),
            'region_code': SIDO_TO_REGION_CODE.get(codes['sido']),
            'region_name': region,
            'address': clean_address(value(item, 'actPlace')),
            'recruit_start_date': date_value(value(item, 'noticeBgnde')),
            'recruit_end_date': date_value(value(item, 'noticeEndde')),
            'activity_start_date': date_value(value(item, 'progrmBgnde')),
            'activity_end_date': date_value(value(item, 'progrmEndde')),
        })
    return results


def clean_address(text):
    text = (text or '').strip()
    if not text or re.sub(r'\s+', '', text) in {'수요처지도', '봉사장소지도', '지도보기', '지도', '없음', '-'}:
        return None
    return text[:255]


def resolve_address(address, place, description, post_address=None):
    for candidate in (address, place):
        cleaned = clean_address(candidate)
        if cleaned:
            return cleaned
    match = re.search(r'(?:활동|봉사)\s*(?:장소|위치)\s*[:：]\s*([^\r\n]+)', description or '')
    if match and clean_address(match.group(1)):
        return clean_address(match.group(1))
    return clean_address(post_address)


class Budget:
    """상세조회 일일 한도. 오늘(KST) sync_runs 에 기록된 호출 수 + 이번 실행 호출 수"""

    def __init__(self, used_today):
        self.used_today = used_today
        self.this_run = 0

    def reserve(self):
        if self.used_today + self.this_run >= DETAIL_DAILY_BUDGET:
            return False
        self.this_run += 1
        return True


def fetch_detail(session, key, external_id, budget):
    if not budget.reserve():
        log('  상세조회 일일 예산에 도달했습니다.')
        return None
    root = request_xml(session, 'getVltrPartcptnItem', {
        'serviceKey': key,
        'pageNo': 1,
        'numOfRows': 1,
        'progrmRegistNo': external_id,
    })
    if root is None:
        return None
    item = root.find('./body/items/item')
    if item is None or value(item, 'progrmRegistNo') != external_id:
        log('  상세조회 결과가 비었거나 공고번호가 다릅니다.')
        return None
    description = value(item, 'progrmCn')
    # 담당자명(nanmmbyNmAdmn)·전화(telno)·팩스(fxnum)·이메일 필드는 읽지 않음
    return {
        'description': description,
        'capacity': int_value(value(item, 'rcritNmpr')),
        'applicant_count': int_value(value(item, 'appTotal')),
        'address': resolve_address(value(item, 'areaAddress1'), value(item, 'actPlace'), description, value(item, 'postAdres')),
        'source_category': value(item, 'srvcClCode'),
        'recruit_start_date': date_value(value(item, 'noticeBgnde')),
        'recruit_end_date': date_value(value(item, 'noticeEndde')),
        'activity_start_date': date_value(value(item, 'progrmBgnde')),
        'activity_end_date': date_value(value(item, 'progrmEndde')),
        'external_org_name': value(item, 'mnnstNm') or value(item, 'nanmmbyNm'),
        'source_status_code': value(item, 'progrmSttusSe'),
        'hours_per_session': hours_value(value(item, 'actBeginTm'), value(item, 'actEndTm')),
        'adult_ok': value(item, 'adultPosblAt') != 'N',
    }


# ───────── GreenStep 테이블 모양으로 변환 ─────────


def normalize_status(code, recruit_start, recruit_end, base):
    """1365 progrmSttusSe(1 모집대기 · 2 모집중 · 3 모집완료) → activities.status"""
    if recruit_end and recruit_end < base:
        return 'CLOSED'
    if code == '2':
        return 'RECRUITING'
    if code == '3':
        return 'CLOSED'
    if code == '1':
        return 'DRAFT'  # 모집 대기 — 웹에 노출하지 않음
    # 상태 코드를 모르면(상세조회 실패) 모집 기간으로 판단
    if recruit_start and recruit_start <= base and (recruit_end is None or base <= recruit_end):
        return 'RECRUITING'
    return 'DRAFT'


def normalize_category(title, description, source_category):
    title = (title or '').lower()
    description = (description or '').lower()
    source = (source_category or '').strip()
    rules = (
        ('it', ('ai 교육', 'ai 강의', '컴퓨터 교육', '코딩', '소프트웨어 교육', 'it 교육', '디지털 교육', 'pc 교육')),
        ('healthcare', ('환자 돌봄', '환자 지원', '간호 보조', '의료 봉사', '보건 활동')),
        ('education', ('강사 모집', '학습지도', '학습 지도', '교육 보조', '멘토링', '강의', '학습 멘토')),
        ('environment', ('환경정화', '환경 정화', '분리수거', '쓰레기 줍기', '플로깅')),
        ('administration', ('사무 보조', '사무보조', '행정 보조', '행정보조', '문서 정리', '자료 입력')),
        ('care', ('아동 돌봄', '노인 돌봄', '장애인 돌봄', '보육', '일상생활 지원', '식사 보조', '이동 지원')),
    )
    # Prefer explicit activity titles over incidental description terms.
    for text in (title, description):
        for category, keywords in rules:
            if any(keyword in text for keyword in keywords):
                return category
    return {
        '교육': 'education', '환경보호': 'environment',
        '행정보조': 'administration', '보건의료': 'healthcare',
        '주거환경': 'general', '생활편의': 'general',
    }.get(source, 'general')


def summary_of(description):
    """설명 첫 줄을 카드용 한 줄 소개(80자)로"""
    for line in (description or '').splitlines():
        line = re.sub(r'\s+', ' ', line).strip(' -·•▣■□◆◇*')
        if len(line) >= 6:
            return line[:80]
    return ''


def merge_activity(old, listing, detail, state_code):
    """기존 DB 행 + 목록 + 상세를 합쳐 저장할 값을 만듦 (새로 받은 값이 없으면 기존 값 유지)"""
    record = dict(old) if old else {}
    for field, new_value in listing.items():
        if new_value is not None:
            record[field] = new_value
    if detail is not None:
        for field in (
            'description', 'capacity', 'applicant_count', 'address', 'source_category', 'recruit_start_date',
            'recruit_end_date', 'activity_start_date', 'activity_end_date', 'external_org_name', 'hours_per_session',
        ):
            if detail.get(field) is not None:
                record[field] = detail[field]
        state_code = detail.get('source_status_code')

    record['description'] = mask_contacts(record.get('description')) or ''
    record['address'] = resolve_address(record.get('address'), None, record.get('description'))
    record['category'] = CATEGORY_TO_GREENSTEP[
        normalize_category(record.get('title'), record.get('description'), record.get('source_category'))
    ]
    record['status'] = normalize_status(state_code, record.get('recruit_start_date'), record.get('recruit_end_date'), today())
    record['capacity'] = record.get('capacity') if (record.get('capacity') or 0) >= 0 else None
    record['applicant_count'] = max(0, record.get('applicant_count') or 0)
    record['hours_per_session'] = record.get('hours_per_session') or DEFAULT_HOURS
    record['summary'] = summary_of(record['description'])
    return record


# ───────── DB ─────────

ACTIVITY_FIELDS = (
    'external_url', 'external_org_name', 'title', 'description', 'category', 'source_category', 'region_code',
    'region_name', 'address', 'recruit_start_date', 'recruit_end_date', 'activity_start_date', 'activity_end_date',
    'capacity', 'applicant_count', 'status',
)

SELECT_OLD = f"""
    SELECT a.activity_id, {', '.join('a.' + f for f in ACTIVITY_FIELDS)}, d.hours_per_session
    FROM activities a LEFT JOIN activity_details d USING (activity_id)
    WHERE a.source_type = '1365' AND a.external_activity_id = %s
"""

INSERT_ACTIVITY = f"""
    INSERT INTO activities (organization_id, source_type, external_activity_id, {', '.join(ACTIVITY_FIELDS)})
    VALUES (NULL, '1365', %(external_activity_id)s, {', '.join(f'%({f})s' for f in ACTIVITY_FIELDS)})
    RETURNING activity_id
"""

# 값이 실제로 바뀐 경우에만 UPDATE (updated_at 트리거가 불필요하게 갱신되지 않게)
UPDATE_ACTIVITY = f"""
    UPDATE activities SET {', '.join(f'{f} = %({f})s' for f in ACTIVITY_FIELDS)}
    WHERE activity_id = %(activity_id)s
      AND ({' OR '.join(f'{f} IS DISTINCT FROM %({f})s' for f in ACTIVITY_FIELDS)})
"""

UPSERT_DETAILS = """
    INSERT INTO activity_details (activity_id, summary, hours_per_session, difficulty_reason, weight, weight_status)
    VALUES (%(activity_id)s, %(summary)s, %(hours_per_session)s,
            '1365 수집 공고는 직무 난이도 가중치 자동 분류 대상이 아닙니다.', 1.0, 'NONE')
    ON CONFLICT (activity_id) DO UPDATE
    SET summary = EXCLUDED.summary, hours_per_session = EXCLUDED.hours_per_session
"""


def wait_for_schema(conn_str, attempts=60):
    """backend 컨테이너가 Alembic 마이그레이션을 끝낼 때까지 대기 (최대 약 5분)"""
    for _ in range(attempts):
        try:
            with psycopg.connect(conn_str) as conn:
                if conn.execute("SELECT to_regclass('public.sync_runs') IS NOT NULL").fetchone()[0]:
                    return
        except psycopg.OperationalError:
            pass
        log('DB 스키마 준비 대기 중…')
        time.sleep(5)
    raise SystemExit('DB 스키마가 준비되지 않았습니다. backend 컨테이너 로그를 확인하세요.')


def collect_once(session, key, conn):
    log(f'\n수집 시작: {timestamp()} (지역별 최대 {REGION_LIMIT}개)')
    base = today()
    used_today = conn.execute(
        """SELECT COALESCE(SUM(detail_requests), 0) FROM sync_runs
           WHERE source = '1365' AND (started_at AT TIME ZONE 'Asia/Seoul')::date = %s""",
        (base,),
    ).fetchone()[0]
    run_id = conn.execute("INSERT INTO sync_runs (source) VALUES ('1365') RETURNING sync_run_id").fetchone()[0]
    conn.commit()

    budget = Budget(used_today)
    stats = {'fetched': 0, 'inserted': 0, 'updated': 0, 'closed': 0, 'skipped': 0}
    seen = set()
    errors = []
    try:
        for region, codes in REGIONS.items():
            log(f'\n[{region}]')
            listings = fetch_list(session, key, region, codes)
            if listings is None:
                errors.append(f'{region} 목록 조회 실패')
                continue
            for listing in listings:
                external_id = listing['external_activity_id']
                if external_id in seen:
                    continue
                seen.add(external_id)
                stats['fetched'] += 1
                save_one(session, key, conn, listing, budget, stats)
                time.sleep(REQUEST_DELAY_SECONDS)

        # 모집 마감일이 지난 1365 공고 마감 처리 (목록에서 사라진 공고 포함)
        stats['closed'] += conn.execute(
            """UPDATE activities SET status = 'CLOSED'
               WHERE source_type = '1365' AND status IN ('RECRUITING', 'DRAFT') AND recruit_end_date < %s""",
            (base,),
        ).rowcount
        conn.commit()
    except Exception as exc:
        conn.rollback()
        errors.append(f'{type(exc).__name__}: {str(exc)[:200]}')
        raise
    finally:
        conn.execute(
            """UPDATE sync_runs SET finished_at = now(), fetched = %(fetched)s, inserted = %(inserted)s, updated = %(updated)s,
                   closed = %(closed)s, skipped = %(skipped)s, detail_requests = %(detail)s, error = %(error)s
               WHERE sync_run_id = %(id)s""",
            {**stats, 'detail': budget.this_run, 'error': '; '.join(errors) or None, 'id': run_id},
        )
        conn.commit()

    open_count = conn.execute("SELECT count(*) FROM activities WHERE source_type = '1365' AND status = 'RECRUITING'").fetchone()[0]
    log('\n수집 종료')
    log(f'  확인한 고유 공고: {stats["fetched"]}개')
    log(f'  신규: {stats["inserted"]} / 변경: {stats["updated"]} / 마감 처리: {stats["closed"]} / 건너뜀: {stats["skipped"]}')
    log(f'  오늘 상세조회 요청: {budget.used_today + budget.this_run}/{DETAIL_DAILY_BUDGET}')
    log(f'  DB 의 모집 중 1365 공고: {open_count}개')


def save_one(session, key, conn, listing, budget, stats):
    external_id = listing['external_activity_id']
    row = conn.execute(SELECT_OLD, (external_id,)).fetchone()
    old = None
    if row:
        old = dict(zip(('activity_id', *ACTIVITY_FIELDS, 'hours_per_session'), row))
        old['hours_per_session'] = float(old['hours_per_session']) if old['hours_per_session'] is not None else None
    state = conn.execute(
        "SELECT source_status_code, last_detail_at FROM external_sync_state WHERE source_type = '1365' AND external_activity_id = %s",
        (external_id,),
    ).fetchone()
    stale = state is None or state[1] is None or state[1] < now() - timedelta(hours=DETAIL_REFRESH_HOURS)
    detail = fetch_detail(session, key, external_id, budget) if (old is None or stale) else None
    state_code = state[0] if state else None

    if detail is not None:
        conn.execute(
            """INSERT INTO external_sync_state (source_type, external_activity_id, source_status_code, last_detail_at)
               VALUES ('1365', %s, %s, now())
               ON CONFLICT (source_type, external_activity_id)
               DO UPDATE SET source_status_code = EXCLUDED.source_status_code, last_detail_at = EXCLUDED.last_detail_at""",
            (external_id, detail.get('source_status_code')),
        )
        if ADULT_ONLY and not detail['adult_ok']:
            log(f'  {external_id} | 건너뜀 (성인 참여 불가)')
            if old:
                conn.execute("UPDATE activities SET status = 'CLOSED' WHERE activity_id = %s AND status <> 'CLOSED'", (old['activity_id'],))
            stats['skipped'] += 1
            conn.commit()
            return

    record = merge_activity(old, listing, detail, state_code)
    record['external_activity_id'] = external_id
    if not record.get('title'):
        stats['skipped'] += 1
        conn.commit()
        return
    try:
        with conn.transaction():  # 이 공고만 되돌릴 수 있게 savepoint
            if old is None:
                record['activity_id'] = conn.execute(INSERT_ACTIVITY, record).fetchone()[0]
                stats['inserted'] += 1
                action = '신규'
            else:
                record['activity_id'] = old['activity_id']
                changed = conn.execute(UPDATE_ACTIVITY, record).rowcount
                if changed or record['hours_per_session'] != old['hours_per_session']:
                    stats['updated'] += 1
                    action = '변경'
                else:
                    action = '동일'
            conn.execute(UPSERT_DETAILS, record)
        log(f'  {external_id} | {action} | {record["status"]} | {record["title"]}')
    except psycopg.Error as exc:
        # 날짜 순서가 뒤바뀐 공고 등 제약 위반 → 이 공고만 건너뜀
        stats['skipped'] += 1
        log(f'  {external_id} | 저장 실패, 건너뜀 ({type(exc).__name__})')
    conn.commit()


def main():
    if RUN_MODE not in ('once', 'loop'):
        raise SystemExit('RUN_MODE는 once 또는 loop만 가능합니다.')
    if not 1 <= REGION_LIMIT <= 100:
        raise SystemExit('REGION_LIMIT는 1~100 사이여야 합니다.')
    if not 1 <= DETAIL_DAILY_BUDGET <= 1000:
        raise SystemExit('DETAIL_DAILY_BUDGET은 1~1000 사이여야 합니다.')
    key = os.getenv('SERVICE_KEY', '').strip()
    if key == 'YOUR_API_KEY':
        key = ''
    if not key and sys.stdin.isatty():
        key = getpass.getpass('1365 API 인증키 입력: ').strip()
    if not key:
        raise SystemExit('SERVICE_KEY가 없습니다. src/api/.env 에 SERVICE_KEY=... 를 넣어 주세요.')

    log(f'GreenStep Collector | RUN_MODE={RUN_MODE} | REGION_LIMIT={REGION_LIMIT} | 주기 {INTERVAL_SECONDS}초')
    wait_for_schema(DATABASE_URL)
    with requests.Session() as session:
        while True:
            started = now()
            try:
                with psycopg.connect(DATABASE_URL) as conn:
                    collect_once(session, key, conn)
            except Exception as exc:  # 한 번 실패해도 다음 주기에 다시 시도
                log(f'수집 또는 저장 오류: {type(exc).__name__}')
            if RUN_MODE == 'once':
                break
            next_run = started + timedelta(seconds=INTERVAL_SECONDS)
            remaining = max(0, (next_run - now()).total_seconds())
            log(f'다음 수집: {next_run.isoformat(timespec="seconds")}')
            time.sleep(remaining)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        log('\n사용자 요청으로 종료했습니다.')
