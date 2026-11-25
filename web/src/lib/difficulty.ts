/**
 * 직무 난이도 가중치(+0.2) 자동 후보 판정.
 * 기획서 2-2: 아동·노인·환자 등 도움이 필요한 대상을 '직접' 지원하는 활동
 * (1:1 학습지도, 개별 돌봄, 정서지원 등). 단순 행정 보조·물품 정리와 구분하기 위해
 * 대상자 · 수행 업무 · 개별 지원 여부를 복합적으로 판단한다.
 *
 * 결과는 '가중치 적용 후보'일 뿐이며, 운영자가 확인하기 전까지 가중치는 1.0 으로 계산한다.
 * 실제 판정은 서버가 다시 수행한다 (기관이 값을 조작할 수 없게).
 */

const TARGET_WORDS = ['아동', '어린이', '청소년', '학생', '노인', '어르신', '환자', '장애', '이주', '다문화', '한부모', '독거'];
const DIRECT_WORDS = ['학습지도', '멘토링', '돌봄', '정서', '상담', '말벗', '식사 보조', '이동 보조', '재활', '간병', '1:1', '일대일', '개별'];
const SIMPLE_WORDS = ['행정', '정리', '분류', '포장', '청소', '사무', '입력', '물품', '플로깅', '안내'];

export interface DifficultyResult {
  candidate: boolean;
  reason: string;
  checks: { target: boolean; direct: boolean; individual: boolean; simpleOnly: boolean };
}

export function judgeDifficulty(input: { targetGroup: string; tasks: string; individualSupport: boolean }): DifficultyResult {
  const target = TARGET_WORDS.some((w) => input.targetGroup.includes(w));
  const direct = DIRECT_WORDS.some((w) => input.tasks.includes(w));
  const simpleOnly = !direct && SIMPLE_WORDS.some((w) => input.tasks.includes(w));
  const individual = input.individualSupport;

  const candidate = target && direct && individual && !simpleOnly;
  let reason: string;
  if (candidate) reason = '도움이 필요한 대상을 1:1로 직접 지원하는 활동으로 분류되었습니다.';
  else if (!target) reason = '대상자가 아동·노인·환자 등 지원이 필요한 대상으로 확인되지 않았습니다.';
  else if (simpleOnly) reason = '수행 업무가 단순 행정·물품 정리로 분류되었습니다.';
  else if (!direct) reason = '수행 업무에서 직접 지원(학습지도·돌봄·정서지원 등)이 확인되지 않았습니다.';
  else reason = '개별(1:1) 지원 활동이 아닙니다.';

  return { candidate, reason, checks: { target, direct, individual, simpleOnly } };
}
