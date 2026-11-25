import type { Category, WeightFlags } from '../data/types';

/**
 * 사회적 가치(원) = 활동 시간(h) × 표준 단가(원/h) × 기관 가중치(1.0 ~ 1.5)
 * - 기본 10,320원 = 2026년 최저임금 / 돌봄·보육 11,120원 = 2026년 아이돌보미 기본 시급
 * - 단가·가중치는 기록 제출 시점 스냅샷으로 고정 (서버가 저장)
 */
export const BASE_RATE = 10_320;
export const CARE_RATE = 11_120;

export const CATEGORY_META: Record<Category, { label: string; rate: number; rateLabel: string }> = {
  education: { label: '교육·멘토링', rate: BASE_RATE, rateLabel: '전문(IT·교육)' },
  care: { label: '돌봄·보육', rate: CARE_RATE, rateLabel: '돌봄·보육' },
  environment: { label: '생활·환경', rate: BASE_RATE, rateLabel: '일반·행정·환경' },
  health: { label: '보건·의료', rate: BASE_RATE, rateLabel: '보건·환자 돌봄' },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export function rateOf(category: Category): number {
  return CATEGORY_META[category].rate;
}

export const WEIGHT_MIN = 1.0;
export const WEIGHT_MAX = 1.5;

/** 가산 항목. 현재 직무 난이도(+0.2)만 적용. 모집 부족·취약 지역은 기준 확정 전(보류) */
export const WEIGHT_RULES = {
  difficulty: { label: '직무 난이도', add: 0.2, active: true },
  shortage: { label: '모집 부족', add: 0.2, active: false },
  vulnerable: { label: '취약 지역', add: 0.1, active: false },
} as const;

/** 가중치 = 1.0 + 적용 중인 가산 합계, 1.0 ~ 1.5 로 제한 */
export function weightOf(flags: WeightFlags): number {
  let w = 1;
  (Object.keys(WEIGHT_RULES) as (keyof WeightFlags)[]).forEach((k) => {
    if (flags[k] && WEIGHT_RULES[k].active) w += WEIGHT_RULES[k].add;
  });
  return Math.round(Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, w)) * 10) / 10;
}

export function socialValue(hours: number, rate: number, weight: number): number {
  return Math.round(hours * rate * weight);
}

/** "09:00" ~ "12:30" → 3.5 (0.5시간 단위 내림) */
export function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.floor(minutes / 30) / 2;
}
