import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Activity, ActivityStatus, Category, ParticipationStatus, WeightStatus } from '../data/types';
import { CATEGORY_META, socialValue, rateOf } from '../lib/sroi';
import { daysUntil, num, period, won } from '../lib/format';
import { Icon } from './Icon';

/* ───── 상태 배지 ───── */

const P_STATUS: Record<ParticipationStatus, [string, string]> = {
  PENDING: ['승인 대기', 'st-warn'],
  APPROVED: ['승인', 'st-green'],
  REJECTED: ['반려', 'st-danger'],
  EXTERNAL_PENDING: ['검증 대기', 'st-violet'],
};
export function RecordStatus({ status }: { status: ParticipationStatus }) {
  const [label, cls] = P_STATUS[status];
  return <span className={`st ${cls}`}>{label}</span>;
}
export const recordStatusLabel = (s: ParticipationStatus) => P_STATUS[s][0];

const A_STATUS: Record<ActivityStatus, [string, string]> = {
  DRAFT: ['임시저장', 'st-gray'],
  RECRUITING: ['모집 중', 'st-blue'],
  CLOSED: ['마감', 'st-gray'],
  CANCELLED: ['취소', 'st-gray'],
};
export function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  const [label, cls] = A_STATUS[status];
  return <span className={`st ${cls}`}>{label}</span>;
}

export function WeightBadge({ status, weight }: { status: WeightStatus; weight: number }) {
  if (status === 'CONFIRMED') return <span className="st st-green">가중치 {weight.toFixed(1)} · 난이도 확정</span>;
  if (status === 'CANDIDATE') return <span className="st st-warn">난이도 가중치 후보 · 운영자 확인 중</span>;
  return <span className="st st-gray">가중치 1.0</span>;
}

/* ───── KPI ───── */

export function Kpis({ items }: { items: { label: string; value: string; unit: string; note?: string }[] }) {
  return (
    <div className="kpis">
      {items.map((k) => (
        <div className="kpi" key={k.label}>
          <p>{k.label}</p>
          <strong>
            {k.value}
            <small>{k.unit}</small>
          </strong>
          {k.note && <p className="kpi-note">{k.note}</p>}
        </div>
      ))}
    </div>
  );
}

/* ───── 막대 차트 (월별) ───── */

export function BarChart({ data, format = (v) => num(v) }: { data: { label: string; value: number }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bar-chart" role="img" aria-label={data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}>
      {data.map((d) => (
        <div className="bar" key={d.label}>
          {d.value > 0 && <b>{format(d.value)}</b>}
          <i style={{ height: `${(d.value / max) * 100}%` }} />
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ───── 활동 카드 (원본 시안 구조 그대로) ───── */

export function ActivityCard({ a, saved, onToggleSave }: { a: Activity; saved?: boolean; onToggleSave?: () => void }) {
  const value = socialValue(a.hoursPerSession, rateOf(a.category), a.weight);
  const left = daysUntil(a.recruitEndDate);
  const closed = left < 0 || a.status !== 'RECRUITING';
  return (
    <article className="activity-card">
      <div className="card-media no-image">
        <span className={`badge${!closed && left <= 3 ? ' urgent' : ''}`}>
          {closed ? '모집 마감' : left <= 3 ? '마감 임박' : '모집 중'}
        </span>
        {onToggleSave && (
          <button className="icon-button bookmark" aria-label={`${a.title} 관심 활동 저장`} aria-pressed={saved} onClick={onToggleSave}>
            <Icon name="bookmark" />
          </button>
        )}
      </div>
      <div className="card-content">
        <p className="card-category">
          <span>{CATEGORY_META[a.category].label}</span>
          <span>
            {a.regionName}
          </span>
          {a.sourceType === '1365' && <span>1365 공고</span>}
        </p>
        <h3 className="card-title">
          <Link to={`/activities/${a.id}`} className="block hover:text-hover hover:underline underline-offset-4" style={{ whiteSpace: 'pre-line', textWrap: 'balance' }}>
            {a.title}
          </Link>
        </h3>
        <p className="card-info">
          <Icon name="pin" small />
          {a.orgName}
        </p>
        <p className="card-info">
          <Icon name="calendar" small />
          {period(a.activityStartDate, a.activityEndDate)}
        </p>
      </div>
      <div className="card-footer">
        <div className="value-label">
          예상 사회적 가치
          <small>
            1회 {a.hoursPerSession}시간 · 가중치 {a.weight.toFixed(1)}
            {a.weightStatus === 'CANDIDATE' ? ' (후보)' : ''}
          </small>
        </div>
        <p className="card-value">
          {won(value)}
          <small>원</small>
        </p>
      </div>
    </article>
  );
}

/* ───── 사회적 가치 계산기 (원본 시안) ───── */

export function Calculator({ initialHours = 10, initialCategory = 'care', initialWeight = 1, fixed }: { initialHours?: number; initialCategory?: Category; initialWeight?: number; fixed?: boolean }) {
  const [hours, setHours] = useState(String(initialHours));
  const [category, setCategory] = useState<Category>(initialCategory);
  const [weight, setWeight] = useState(initialWeight);
  const h = Number(hours);
  const valid = Number.isFinite(h) && h >= 0.5 && h <= 1000 && Math.round(h * 2) === h * 2;
  const rate = rateOf(category);
  // 원본 시안의 분야 선택지 순서·문구 그대로
  const FIELD_OPTIONS: [Category, string][] = [
    ['care', '돌봄·보육'],
    ['environment', '일반·행정·환경'],
    ['health', '보건·환자 돌봄'],
    ['education', '전문·IT·교육'],
  ];

  return (
    <div className="calculator">
      <div className="calculator-title">
        <Icon name="chart" />
        <h3>사회적 가치 계산기</h3>
        <span className="example-label">기획안 기준</span>
      </div>
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="calculator-fields">
          <div className="form-field">
            <label htmlFor="calc-hours">활동 시간 (시간)</label>
            <input id="calc-hours" type="number" min={0.5} max={1000} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} aria-invalid={!valid} />
          </div>
          <div className="form-field">
            <label htmlFor="calc-field">활동 분야</label>
            <select id="calc-field" value={category} onChange={(e) => setCategory(e.target.value as Category)} disabled={fixed}>
              {FIELD_OPTIONS.map(([c, label]) => (
                <option key={c} value={c}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field wide">
            <label htmlFor="calc-weight">가중치 시나리오</label>
            <select id="calc-weight" value={weight} onChange={(e) => setWeight(Number(e.target.value))} disabled={fixed}>
              <option value={1}>기본 · 1.0</option>
              <option value={1.2}>고난이도 활동 예시 · 1.2</option>
              <option value={1.5}>최대 가중치 예시 · 1.5</option>
            </select>
          </div>
        </div>
        <div className="calc-result">
          <div className="calc-result-top">
            <span>예상 사회적 가치</span>
            <output aria-live="polite">
              {valid ? (
                <>
                  {won(socialValue(h, rate, weight))}
                  <small> 원</small>
                </>
              ) : (
                '입력 확인'
              )}
            </output>
          </div>
          <p className="calc-formula">{valid ? `${num(h)}시간 × ${won(rate)}원 × ${weight.toFixed(1)}` : '0.5~1,000시간을 0.5시간 단위로 입력해 주세요.'}</p>
        </div>
      </form>
      <p className="calc-disclaimer">
        2026년 기획안 기준의 추정값이며, 보수나 지원금이 아닙니다. 최종 반영은 활동 검증 후 이루어집니다. 모집 부족·취약 지역 가중치의 세부 기준은 검토 중입니다.
      </p>
    </div>
  );
}

/* ───── 공통 상태 표시 ───── */

export function Loading() {
  return <p className="py-16 text-center text-muted">불러오는 중…</p>;
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="form-error flex items-center justify-between gap-4">
      <span>{message}</span>
      {onRetry && (
        <button className="button small" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <h3 className="text-lg font-bold">{title}</h3>
      {children}
    </div>
  );
}
