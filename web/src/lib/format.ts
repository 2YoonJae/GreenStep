const nf = new Intl.NumberFormat('ko-KR');

export const won = (n: number) => nf.format(Math.round(n));
export const num = (n: number) => nf.format(n);
export const pct = (r: number) => `${Math.round(r * 1000) / 10}%`;

export function dateDot(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '.');
}

export function period(start: string, end: string): string {
  if (start === end) return dateDot(start);
  const s = dateDot(start);
  const e = start.slice(0, 4) === end.slice(0, 4) ? dateDot(end).slice(5) : dateDot(end);
  return `${s} – ${e}`;
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 마감까지 남은 일수 (오늘 마감 = 0, 지남 = 음수) */
export function daysUntil(iso: string): number {
  const t = new Date(today() + 'T00:00:00');
  const d = new Date(iso.slice(0, 10) + 'T00:00:00');
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

export function dday(iso: string): string {
  const n = daysUntil(iso);
  if (n < 0) return '마감';
  if (n === 0) return 'D-DAY';
  return `D-${n}`;
}

export function maskName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

/** 사업자등록번호 숫자 10자리 → 000-00-00000 */
export function bizNo(digits: string): string {
  const d = digits.replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : digits;
}
