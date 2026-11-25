"""도메인 규칙 (프론트 web/src/lib/difficulty.ts · sroi.ts · data/types.ts 와 같은 규칙).
가중치·단가는 서버가 최종 결정합니다. 기관이 보낸 값으로 가중치를 올릴 수 없습니다."""
from dataclasses import dataclass

# 2026 표준 단가 (원/시간)
BASE_RATE = 10_320  # 최저임금
CARE_RATE = 11_120  # 돌봄·보육
CATEGORY_RATE = {"education": BASE_RATE, "care": CARE_RATE, "environment": BASE_RATE, "health": BASE_RATE}

# 시·도 → 행정구역 코드 (activities.region_code)
REGION_CODE = {
    "서울": "11", "부산": "26", "대구": "27", "인천": "28", "광주": "29", "대전": "30", "울산": "31", "세종": "36",
    "경기": "41", "강원": "51", "충북": "43", "충남": "44", "전북": "52", "전남": "46", "경북": "47", "경남": "48", "제주": "50",
}

TARGET_WORDS = ["아동", "어린이", "청소년", "학생", "노인", "어르신", "환자", "장애", "이주", "다문화", "한부모", "독거"]
DIRECT_WORDS = ["학습지도", "멘토링", "돌봄", "정서", "상담", "말벗", "식사 보조", "이동 보조", "재활", "간병", "1:1", "일대일", "개별"]
SIMPLE_WORDS = ["행정", "정리", "분류", "포장", "청소", "사무", "입력", "물품", "플로깅", "안내"]


@dataclass(frozen=True)
class Difficulty:
    candidate: bool
    reason: str


def judge_difficulty(target_group: str, tasks: str, individual_support: bool) -> Difficulty:
    """직무 난이도 가중치(+0.2) 자동 '후보' 판정. 운영자 확인 전까지 가중치는 1.0"""
    target = any(w in target_group for w in TARGET_WORDS)
    direct = any(w in tasks for w in DIRECT_WORDS)
    simple_only = not direct and any(w in tasks for w in SIMPLE_WORDS)
    candidate = target and direct and individual_support and not simple_only
    if candidate:
        reason = "도움이 필요한 대상을 1:1로 직접 지원하는 활동으로 분류되었습니다."
    elif not target:
        reason = "대상자가 아동·노인·환자 등 지원이 필요한 대상으로 확인되지 않았습니다."
    elif simple_only:
        reason = "수행 업무가 단순 행정·물품 정리로 분류되었습니다."
    elif not direct:
        reason = "수행 업무에서 직접 지원(학습지도·돌봄·정서지원 등)이 확인되지 않았습니다."
    else:
        reason = "개별(1:1) 지원 활동이 아닙니다."
    return Difficulty(candidate, reason)
