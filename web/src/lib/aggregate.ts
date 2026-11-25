import type { ActivityStat, MonthlyStat, Organization, Participation, ReportSnapshot } from '../data/types';

/** APPROVED 기록만 이력서 · KPI · 보고서에 집계한다 */
export const approvedOnly = (list: Participation[]) => list.filter((p) => p.status === 'APPROVED');

export function sumValue(list: Participation[]) {
  return approvedOnly(list).reduce((s, p) => s + p.valueKrw, 0);
}
export function sumHours(list: Participation[]) {
  return approvedOnly(list).reduce((s, p) => s + p.hours, 0);
}
export function uniqueYouth(list: Participation[]) {
  return new Set(approvedOnly(list).map((p) => p.userId)).size;
}

/** 승인률 = 승인 / (승인 + 반려). 대기 건은 제외 */
export function approvalRate(list: Participation[]) {
  const a = list.filter((p) => p.status === 'APPROVED').length;
  const r = list.filter((p) => p.status === 'REJECTED').length;
  return a + r === 0 ? 0 : a / (a + r);
}

export function monthly(list: Participation[], year: number): MonthlyStat[] {
  const rows: MonthlyStat[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, value: 0, hours: 0, records: 0, youth: 0 }));
  const youth: Set<string>[] = Array.from({ length: 12 }, () => new Set());
  approvedOnly(list)
    .filter((p) => Number(p.date.slice(0, 4)) === year)
    .forEach((p) => {
      const m = Number(p.date.slice(5, 7)) - 1;
      rows[m].value += p.valueKrw;
      rows[m].hours += p.hours;
      rows[m].records += 1;
      youth[m].add(p.userId);
    });
  rows.forEach((r, i) => (r.youth = youth[i].size));
  return rows;
}

export function byActivity(list: Participation[]): ActivityStat[] {
  const map = new Map<string, ActivityStat & { ids: Set<string> }>();
  approvedOnly(list).forEach((p) => {
    const key = p.activityId ?? p.activityTitle;
    const row = map.get(key) ?? { activityId: p.activityId, title: p.activityTitle, category: p.category, value: 0, hours: 0, youth: 0, ids: new Set<string>() };
    row.value += p.valueKrw;
    row.hours += p.hours;
    row.ids.add(p.userId);
    map.set(key, row);
  });
  return [...map.values()]
    .map(({ ids, ...r }) => ({ ...r, youth: ids.size }))
    .sort((a, b) => b.value - a.value);
}

/** 기관 연간 집계 스냅샷 (봉사자 개인정보 없이 인원수만) */
export function buildSnapshot(org: Pick<Organization, 'id' | 'name'>, all: Participation[], year: number): ReportSnapshot {
  const list = all.filter((p) => p.orgId === org.id && Number(p.date.slice(0, 4)) === year);
  return {
    orgId: org.id,
    orgName: org.name,
    year,
    totalValue: sumValue(list),
    totalHours: sumHours(list),
    youthCount: uniqueYouth(list),
    approvedCount: list.filter((p) => p.status === 'APPROVED').length,
    rejectedCount: list.filter((p) => p.status === 'REJECTED').length,
    approvalRate: approvalRate(list),
    activityCount: byActivity(list).length,
    monthly: monthly(list, year),
    byActivity: byActivity(list),
    generatedAt: new Date().toISOString(),
  };
}
