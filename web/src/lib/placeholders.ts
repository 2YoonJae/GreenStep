import type { ReportSnapshot } from '../data/types';
import { num, won } from './format';

/**
 * ESG 경영 보고서 문장의 숫자 자리 표시. AI·기관은 숫자를 직접 쓰지 않고 자리 표시만 쓰며,
 * 서버 집계값(발행 후에는 고정 스냅샷)으로 채운다. 유료 보고서의 금액 오류 방지.
 */
export const PLACEHOLDERS = ['{총가치}', '{총시간}', '{참여청년}', '{연도}'] as const;

export function fillPlaceholders(text: string, s: Pick<ReportSnapshot, 'totalValue' | 'totalHours' | 'youthCount' | 'year'>): string {
  return text
    .replace(/\{총가치\}/g, `${won(s.totalValue)}원`)
    .replace(/\{총시간\}/g, `${num(s.totalHours)}시간`)
    .replace(/\{참여청년\}/g, `${num(s.youthCount)}명`)
    .replace(/\{연도\}/g, `${s.year}년`);
}
