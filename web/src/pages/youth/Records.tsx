import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { ParticipationStatus } from '../../data/types';
import { SubPage } from '../../components/SubPage';
import { RequireRole } from '../../components/Guards';
import { Icon } from '../../components/Icon';
import { BarChart, Empty, ErrorBox, Loading, RecordStatus, recordStatusLabel } from '../../components/ui';
import { useAsync } from '../../lib/useAsync';
import { monthly, sumHours, sumValue } from '../../lib/aggregate';
import { dateDot, num, won } from '../../lib/format';
import { CATEGORY_META } from '../../lib/sroi';
import { downloadCsv } from '../../lib/csv';

type Tab = 'ALL' | ParticipationStatus;
const TABS: [Tab, string][] = [
  ['ALL', '전체'],
  ['APPROVED', '승인'],
  ['PENDING', '승인 대기'],
  ['REJECTED', '반려'],
  ['EXTERNAL_PENDING', '검증 대기(1365)'],
];

function Body() {
  const { data, error, loading, reload } = useAsync(() => api.participations.mine(), []);
  const [tab, setTab] = useState<Tab>('ALL');
  const years = useMemo(() => [...new Set((data ?? []).map((p) => Number(p.date.slice(0, 4))))].sort((a, b) => b - a), [data]);
  const [year, setYear] = useState<number | null>(null);
  const y = year ?? years[0] ?? new Date().getFullYear();

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const all = data!;
  const rows = all.filter((p) => tab === 'ALL' || p.status === tab);
  const months = monthly(all, y);

  const exportCsv = () =>
    downloadCsv(
      `greenstep_활동기록_${new Date().toISOString().slice(0, 10)}.csv`,
      ['활동일', '활동명', '기관', '분야', '시작', '종료', '시간', '단가(스냅샷)', '가중치(스냅샷)', '사회적 가치(원)', '상태', '반려 사유'],
      rows.map((p) => [p.date, p.activityTitle, p.orgName, CATEGORY_META[p.category].label, p.startTime, p.endTime, p.hours, p.rateSnapshot, p.weightSnapshot, p.valueKrw, recordStatusLabel(p.status), p.rejectReason ?? '']),
    );

  return (
    <div className="flex flex-col gap-8">
      <section className="panel">
        <div className="panel-title">
          <h2>월별 승인된 사회적 가치</h2>
          <div className="flex items-center gap-3">
            <small>
              {y}년 합계 {won(sumValue(all.filter((p) => p.date.startsWith(String(y)))))}원 · {num(sumHours(all.filter((p) => p.date.startsWith(String(y)))))}시간
            </small>
            {years.length > 1 && (
              <select className="w-auto" style={{ minHeight: 36, padding: '4px 28px 4px 10px', fontSize: 14 }} value={y} onChange={(e) => setYear(Number(e.target.value))} aria-label="연도">
                {years.map((v) => (
                  <option key={v} value={v}>{v}년</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <BarChart data={months.map((m) => ({ label: `${m.month}월`, value: m.value }))} format={(v) => (v >= 10000 ? `${Math.round(v / 1000) / 10}만` : num(v))} />
      </section>

      <section>
        <div className="filter-row">
          <div className="filters">
            {TABS.map(([t, l]) => (
              <button key={t} className="filter" aria-pressed={tab === t} onClick={() => setTab(t)}>
                {l} <span className="text-muted">{t === 'ALL' ? all.length : all.filter((p) => p.status === t).length}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="button small" onClick={exportCsv} disabled={rows.length === 0}>
              <Icon name="download" small />
              CSV 내보내기
            </button>
            <Link className="button small primary" to="/me/records/new">
              <Icon name="plus" small />
              활동 기록 제출
            </Link>
          </div>
        </div>
        {rows.length === 0 ? (
          <Empty title="해당하는 기록이 없습니다" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>활동일</th>
                <th>활동 · 기관</th>
                <th>시간</th>
                <th className="num">산정 (스냅샷)</th>
                <th className="num">사회적 가치</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{dateDot(p.date)}</td>
                  <td>
                    <p className="font-bold">{p.activityTitle}</p>
                    <p className="text-[13px] text-muted">
                      {p.orgName} · {CATEGORY_META[p.category].label}
                      {p.certificateName && ` · 첨부 ${p.certificateName}`}
                    </p>
                    {p.rejectReason && <p className="mt-1 text-[13px] text-danger">반려 사유: {p.rejectReason}</p>}
                  </td>
                  <td className="whitespace-nowrap">
                    {p.startTime}~{p.endTime}
                    <span className="ml-1 text-muted">({p.hours}h)</span>
                  </td>
                  <td className="num text-[13px] text-muted">
                    {won(p.rateSnapshot)}원 × {p.weightSnapshot.toFixed(1)}
                  </td>
                  <td className={`num font-bold ${p.status === 'APPROVED' ? '' : 'text-muted'}`}>{won(p.valueKrw)}원</td>
                  <td><RecordStatus status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="activity-note">
          <Icon name="info" small />
          승인(APPROVED)된 기록만 봉사 이력서와 누적 가치에 반영됩니다. 단가·가중치는 제출 시점 값으로 고정됩니다.
        </p>
      </section>
    </div>
  );
}

export default function Records() {
  return (
    <SubPage section="resume" title="나의 활동 기록" desc="제출한 기록의 승인 상태와 월별 사회적 가치를 확인하세요.">
      <RequireRole role="YOUTH">
        <Body />
      </RequireRole>
    </SubPage>
  );
}
