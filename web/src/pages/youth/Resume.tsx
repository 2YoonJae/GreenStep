import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { ResumeDoc } from '../../data/types';
import { SubPage } from '../../components/SubPage';
import { RequireRole } from '../../components/Guards';
import { Icon } from '../../components/Icon';
import { Empty, ErrorBox, Loading } from '../../components/ui';
import { errorMessage, useAsync } from '../../lib/useAsync';
import { useToast } from '../../lib/toast';
import { CATEGORY_META, CATEGORIES } from '../../lib/sroi';
import { dateDot, num, won } from '../../lib/format';

/** A4 봉사 이력서 — 기관이 승인한 기록만 */
function ResumeSheet({ doc }: { doc: ResumeDoc }) {
  const orgs = new Set(doc.items.map((i) => i.orgName)).size;
  const byCat = CATEGORIES.map((c) => ({ c, hours: doc.items.filter((i) => i.category === c).reduce((s, i) => s + i.hours, 0) })).filter((x) => x.hours > 0);
  return (
    <article className="doc" data-theme="teal">
      <div className="flex items-start justify-between">
        <div>
          <p style={{ fontSize: 12, color: '#0f766e', fontWeight: 700, letterSpacing: 2 }}>GREENSTEP · VOLUNTEER RESUME</p>
          <h1 className="mt-1">봉사 이력서</h1>
          <p className="mt-2" style={{ fontSize: 14 }}>
            <strong style={{ fontSize: 18 }}>{doc.user.name}</strong>
            <span className="ml-3 text-muted">{doc.user.school || '—'} · 희망 분야 {doc.user.targetField}</span>
          </p>
        </div>
        <div className="text-right" style={{ fontSize: 11, color: '#58616a' }}>
          <p>확인번호</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1e2124' }}>{doc.confirmNo}</p>
          <p className="mt-1">발급일 {dateDot(doc.issuedAt)}</p>
        </div>
      </div>

      <div className="doc-kpis">
        <div><p>총 사회적 가치</p><strong>{won(doc.totalValue)}원</strong></div>
        <div><p>인증 활동 시간</p><strong>{num(doc.totalHours)}시간</strong></div>
        <div><p>승인 활동 기록</p><strong>{doc.items.length}건</strong></div>
        <div><p>함께한 기관</p><strong>{orgs}곳</strong></div>
      </div>

      <h2>분야별 활동 시간</h2>
      <div className="flex gap-6" style={{ fontSize: 12.5 }}>
        {byCat.map((x) => (
          <span key={x.c}>
            {CATEGORY_META[x.c].label} <strong>{num(x.hours)}시간</strong>
          </span>
        ))}
      </div>

      <h2>기관 승인 활동 내역</h2>
      <table className="table">
        <thead>
          <tr>
            <th>활동일</th>
            <th>활동</th>
            <th>기관</th>
            <th className="num">시간</th>
            <th className="num">가중치</th>
            <th className="num">사회적 가치</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((i) => (
            <tr key={i.id}>
              <td>{dateDot(i.date)}</td>
              <td>{i.activityTitle}</td>
              <td>{i.orgName}</td>
              <td className="num">{i.hours}</td>
              <td className="num">{i.weightSnapshot.toFixed(1)}</td>
              <td className="num">{won(i.valueKrw)}원</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>산정 기준과 검증</h2>
      <p>
        사회적 가치 = 활동 시간 × 표준 단가(2026년 최저임금 10,320원, 돌봄·보육 11,120원) × 기관 가중치(1.0~1.5). 단가와 가중치는 기록 제출 시점의 값으로 고정되며, 주최 기관이 승인한 기록만 반영했습니다.
        사회적 가치는 추정값이며 금전 지급을 의미하지 않습니다.
      </p>
      <p className="mt-2">이 이력서의 진위는 GreenStep 「확인번호 조회」(/verify)에서 확인번호로 확인할 수 있습니다.</p>

      <div className="doc-stamp" style={{ right: '22mm', bottom: '22mm' }}>
        GreenStep
        <br />
        기관 승인
        <br />
        인증
      </div>
    </article>
  );
}

function Body() {
  const notify = useToast();
  const latest = useAsync(() => api.resume.latest(), []);
  const recs = useAsync(() => api.participations.mine(), []);
  const [busy, setBusy] = useState(false);

  if (latest.loading || recs.loading) return <Loading />;
  if (latest.error) return <ErrorBox message={latest.error} />;
  const approved = (recs.data ?? []).filter((p) => p.status === 'APPROVED');
  const newer = latest.data ? approved.filter((p) => !latest.data!.items.some((i) => i.id === p.id)).length : 0;

  const issue = async () => {
    setBusy(true);
    try {
      latest.setData(await api.resume.issue());
      notify('봉사 이력서를 발급했습니다. 확인번호가 부여되었습니다.');
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="panel no-print flex items-center gap-6">
        <div className="flex-1">
          <p className="font-bold">승인된 활동 {approved.length}건이 이력서에 반영됩니다.</p>
          <p className="text-[14px] text-muted">
            {latest.data ? `최근 발급 ${dateDot(latest.data.issuedAt)} · ${latest.data.confirmNo}` : '아직 발급한 이력서가 없습니다.'}
            {newer > 0 && ` · 발급 이후 새로 승인된 기록 ${newer}건 (다시 발급하면 반영)`}
          </p>
        </div>
        <button className="button primary" onClick={issue} disabled={busy || approved.length === 0}>
          <Icon name="file" />
          {latest.data ? '새로 발급' : '이력서 발급'}
        </button>
        {latest.data && (
          <button className="button" onClick={() => window.print()}>
            <Icon name="print" />
            PDF 저장·인쇄
          </button>
        )}
      </div>
      {approved.length === 0 && !latest.data && (
        <Empty title="승인된 활동 기록이 없습니다">
          <p>활동 기록을 제출하고 기관 승인을 받으면 봉사 이력서를 발급할 수 있습니다.</p>
          <Link className="button" to="/me/records/new">활동 기록 제출</Link>
        </Empty>
      )}
      {latest.data && (
        <div className="rounded-lg bg-surface py-8 print:bg-transparent print:py-0">
          <ResumeSheet doc={latest.data} />
        </div>
      )}
      <p className="no-print text-[13px] text-muted">PDF 저장: 「PDF 저장·인쇄」 → 대상 「PDF로 저장」, 용지 A4, 여백 없음, 배경 그래픽 체크.</p>
    </div>
  );
}

export default function Resume() {
  return (
    <SubPage section="resume" title="봉사 이력서 발급" desc="기관이 승인한 활동만으로 만든 이력서를 확인번호와 함께 발급합니다.">
      <RequireRole role="YOUTH">
        <Body />
      </RequireRole>
    </SubPage>
  );
}
