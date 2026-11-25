import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { ORG_TYPE_LABEL, type Participation } from '../../data/types';
import { SubPage } from '../../components/SubPage';
import { RequireApprovedOrg } from '../../components/Guards';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { Empty, ErrorBox, Kpis, Loading, RecordStatus } from '../../components/ui';
import { errorMessage, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { bizNo, dateDot, num, pct, won } from '../../lib/format';
import { WEIGHT_RULES } from '../../lib/sroi';

function Body() {
  const { session } = useAuth();
  const org = session!.org!;
  const notify = useToast();
  const dash = useAsync(() => api.org.dashboard(), []);
  const pending = useAsync(() => api.org.participations('PENDING'), []);
  const recent = useAsync(() => api.org.participations(), []);
  const [selected, setSelected] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState<Participation | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    dash.reload();
    pending.reload();
    recent.reload();
    setSelected([]);
  };

  const approve = async (ids: string[]) => {
    setBusy(true);
    try {
      for (const id of ids) await api.org.approve(id);
      notify(`${ids.length}건을 승인했습니다. 청년 이력서와 기관 성과에 반영됩니다.`);
      refresh();
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    if (!reason.trim()) {
      notify('반려 사유를 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await api.org.reject(rejecting.id, reason);
      notify('기록을 반려했습니다.');
      setRejecting(null);
      setReason('');
      refresh();
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const rows = pending.data ?? [];
  const allChecked = rows.length > 0 && selected.length === rows.length;

  return (
    <div className="flex flex-col gap-8">
      {dash.loading && !dash.data ? (
        <Loading />
      ) : dash.error ? (
        <ErrorBox message={dash.error} onRetry={dash.reload} />
      ) : (
        dash.data && (
          <Kpis
            items={[
              { label: '창출 사회적 가치', value: won(dash.data.totalValue), unit: '원', note: 'GreenStep 산정값 · 승인 기록 기준' },
              { label: '누적 승인 시간', value: num(dash.data.totalHours), unit: '시간' },
              { label: '참여 청년', value: num(dash.data.youthCount), unit: '명', note: `기관 승인률 ${pct(dash.data.approvalRate)}` },
              { label: '승인 대기', value: num(dash.data.pendingCount), unit: '건', note: `게시 중인 활동 ${dash.data.activeActivities}개` },
            ]}
          />
        )
      )}

      <section className="panel">
        <div className="panel-title">
          <h2>승인 대기 기록</h2>
          <div className="flex gap-2">
            <button className="button small primary" disabled={busy || selected.length === 0} onClick={() => approve(selected)}>
              선택 {selected.length}건 승인
            </button>
          </div>
        </div>
        {pending.loading && !pending.data && <Loading />}
        {pending.error && <ErrorBox message={pending.error} />}
        {pending.data && rows.length === 0 && <Empty title="승인 대기 중인 기록이 없습니다"><p>청년이 기록을 제출하면 여기에 표시됩니다.</p></Empty>}
        {rows.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <input type="checkbox" aria-label="전체 선택" checked={allChecked} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} />
                </th>
                <th>제출자</th>
                <th>활동</th>
                <th>활동일 · 시간</th>
                <th className="num">사회적 가치</th>
                <th className="num">처리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${p.userName} 기록 선택`}
                      checked={selected.includes(p.id)}
                      onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))}
                    />
                  </td>
                  <td className="font-bold">{p.userName}</td>
                  <td>
                    {p.activityTitle}
                    {p.note && <p className="text-[13px] text-muted">메모: {p.note}</p>}
                  </td>
                  <td className="whitespace-nowrap">
                    {dateDot(p.date)} {p.startTime}~{p.endTime}
                    <span className="ml-1 text-muted">({p.hours}h)</span>
                  </td>
                  <td className="num">
                    {won(p.valueKrw)}원
                    <p className="text-[12px] text-muted">
                      {won(p.rateSnapshot)} × {p.weightSnapshot.toFixed(1)}
                    </p>
                  </td>
                  <td className="num">
                    <div className="flex justify-end gap-2">
                      <button className="button small green" disabled={busy} onClick={() => approve([p.id])}>승인</button>
                      <button className="button small danger" disabled={busy} onClick={() => setRejecting(p)}>반려</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="activity-note">
          <Icon name="info" small />
          승인한 기록만 청년의 봉사 이력서·기관 KPI·ESG 경영 보고서에 집계됩니다. 단가·가중치는 청년이 제출한 시점 값으로 고정되어 있습니다.
        </p>
      </section>

      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0,1fr) 360px' }}>
        <section className="panel">
          <div className="panel-title">
            <h2>최근 처리 내역</h2>
            <Link className="text-[14px] text-hover hover:underline" to="/org/reports">ESG 경영 보고서 →</Link>
          </div>
          {(recent.data ?? []).filter((p) => p.status !== 'PENDING').length === 0 ? (
            <Empty title="처리한 기록이 없습니다" />
          ) : (
            <table className="table">
              <tbody>
                {(recent.data ?? [])
                  .filter((p) => p.status !== 'PENDING')
                  .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))
                  .slice(0, 6)
                  .map((p) => (
                    <tr key={p.id}>
                      <td>{dateDot(p.date)}</td>
                      <td>{p.userName}</td>
                      <td>{p.activityTitle}</td>
                      <td className="num">{won(p.valueKrw)}원</td>
                      <td><RecordStatus status={p.status} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
        <aside className="panel">
          <div className="panel-title">
            <h2>기관 정보</h2>
          </div>
          <dl className="detail-list" style={{ marginTop: 0 }}>
            <div><dt>기관명</dt><dd>{org.name}</dd></div>
            <div><dt>유형</dt><dd>{ORG_TYPE_LABEL[org.organizationType]}</dd></div>
            <div><dt>사업자번호</dt><dd>{bizNo(org.businessNo)}</dd></div>
            <div><dt>소재지</dt><dd>{org.address}</dd></div>
            <div><dt>공식 이메일</dt><dd>{org.contactEmail}</dd></div>
            <div><dt>담당자</dt><dd>{session!.member?.name} ({session!.member?.email})</dd></div>
          </dl>
          <p className="text-[14px] font-bold">기관 가중치 플래그</p>
          <ul className="mt-2 flex flex-col gap-1 text-[14px]">
            {(Object.keys(WEIGHT_RULES) as (keyof typeof WEIGHT_RULES)[]).map((k) => (
              <li key={k} className="flex justify-between">
                <span>{WEIGHT_RULES[k].label} (+{WEIGHT_RULES[k].add})</span>
                <span className="text-muted">{!WEIGHT_RULES[k].active ? '기준 확정 전' : org[k] ? '적용' : '미적용'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-muted">가중치는 사회적 가치 금액을 올리므로 운영자만 설정합니다. 기관은 수정할 수 없습니다.</p>
        </aside>
      </div>

      <Dialog
        open={rejecting !== null}
        title="기록 반려"
        onClose={() => setRejecting(null)}
        actions={
          <>
            <button className="button" onClick={() => setRejecting(null)}>취소</button>
            <button className="button danger" onClick={reject} disabled={busy}>반려하기</button>
          </>
        }
      >
        {rejecting && (
          <>
            <p>
              <strong>{rejecting.userName}</strong> · {rejecting.activityTitle} · {dateDot(rejecting.date)} ({rejecting.hours}시간)
            </p>
            <div className="field mt-4">
              <label htmlFor="rj-reason">반려 사유 (청년에게 표시됩니다)<span className="req">*</span></label>
              <textarea id="rj-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예) 출석 명단과 활동 시간이 다릅니다." />
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}

export default function Dashboard() {
  return (
    <SubPage section="orgHome" title="기관 대시보드" desc="승인 대기 기록을 처리하고 기관이 만든 사회적 가치를 확인하세요.">
      <RequireApprovedOrg>
        <Body />
      </RequireApprovedOrg>
    </SubPage>
  );
}
