import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Faq } from '../data/types';
import { SubPage } from '../components/SubPage';
import { Icon } from '../components/Icon';
import { ErrorBox, Loading } from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { dateDot, won } from '../lib/format';
import { BASE_RATE, CARE_RATE } from '../lib/sroi';

function Notices({ openId }: { openId: string | null }) {
  const { data, error, loading } = useAsync(() => api.support.notices(), []);
  const [open, setOpen] = useState<string | null>(openId);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  return (
    <ul className="border-t-2 border-ink">
      {data!.map((n) => (
        <li key={n.id} className="border-b border-line">
          <button className="flex w-full items-center gap-4 py-4 text-left" aria-expanded={open === n.id} onClick={() => setOpen(open === n.id ? null : n.id)}>
            {n.pinned && <span className="st st-blue">공지</span>}
            <span className="flex-1 font-bold">{n.title}</span>
            <span className="text-[14px] text-muted">{dateDot(n.date)}</span>
          </button>
          {open === n.id && <p className="whitespace-pre-line bg-surface px-5 py-4 text-body">{n.body}</p>}
        </li>
      ))}
    </ul>
  );
}

function Faqs() {
  const { data, error, loading } = useAsync(() => api.support.faqs(), []);
  const [cat, setCat] = useState<Faq['category'] | ''>('');
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  const cats: Faq['category'][] = ['청년', '기관', '사회적 가치', '기타'];
  return (
    <>
      <div className="filters mb-4">
        <button className="filter" aria-pressed={!cat} onClick={() => setCat('')}>
          전체
        </button>
        {cats.map((c) => (
          <button key={c} className="filter" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="border-t-2 border-ink">
        {data!
          .filter((f) => !cat || f.category === cat)
          .map((f) => (
            <details key={f.id} className="border-b border-line">
              <summary className="flex cursor-pointer items-center gap-3 py-4 font-bold">
                <span className="text-primary">Q</span>
                <span className="flex-1">{f.q}</span>
                <span className="st st-gray">{f.category}</span>
              </summary>
              <p className="flex gap-3 bg-surface px-5 py-4 text-body">
                <span className="font-bold text-green">A</span>
                {f.a}
              </p>
            </details>
          ))}
      </div>
    </>
  );
}

function Guide() {
  const steps = [
    ['01', '활동 찾고 신청하기', '봉사활동 찾기에서 분야·지역으로 활동을 고르고 신청합니다. 1365 공고는 1365에서 신청합니다.', 'PENDING 전'],
    ['02', '활동 기록 제출하기', '활동이 끝나면 날짜와 시작·종료 시간을 제출합니다. 이때 단가와 가중치가 고정됩니다.', 'PENDING'],
    ['03', '기관 확인·승인', '주최 기관이 기록을 확인하고 승인하거나 사유와 함께 반려합니다.', 'APPROVED / REJECTED'],
    ['04', '가치와 이력으로 남기기', '승인된 기록만 봉사 이력서, 기관 KPI, ESG 경영 보고서에 반영됩니다.', '반영'],
  ];
  return (
    <div className="flex flex-col gap-8">
      <div className="steps">
        {steps.map(([n, t, d, s]) => (
          <div className="step" key={n}>
            <div className="step-top">
              <span className="step-number">STEP {n}</span>
              <code className="text-[12px] text-muted">{s}</code>
            </div>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="panel">
          <div className="panel-title">
            <h2>사회적 가치 산정</h2>
          </div>
          <p className="calc-formula" style={{ borderTop: 0, marginTop: 0, paddingTop: 0, fontSize: 16, color: 'var(--ink)' }}>
            사회적 가치(원) = 활동 시간 × 표준 단가 × 기관 가중치(1.0~1.5)
          </p>
          <table className="table mt-4">
            <tbody>
              <tr><td>일반·행정·환경 / 보건 / 전문(IT·교육)</td><td className="num">{won(BASE_RATE)}원</td></tr>
              <tr><td>돌봄·보육</td><td className="num">{won(CARE_RATE)}원</td></tr>
              <tr><td>직무 난이도 가중치</td><td className="num">+0.2</td></tr>
              <tr><td>모집 부족 · 취약 지역 가중치</td><td className="num text-muted">기준 확정 전</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-[13px] text-muted">기본 단가는 2026년 최저임금, 돌봄·보육은 2026년 아이돌보미 기본 시급입니다.</p>
        </div>
        <div className="panel">
          <div className="panel-title">
            <h2>누가 무엇을 받나요?</h2>
          </div>
          <ul className="flex flex-col gap-4 text-body">
            <li className="flex gap-3">
              <Icon name="user" />
              <span><strong className="text-ink">청년</strong> — 활동 신청·기록 제출 → 승인 기록으로 만든 봉사 이력서(PDF), 확인번호 포함</span>
            </li>
            <li className="flex gap-3">
              <Icon name="building" />
              <span><strong className="text-ink">기관</strong> — 활동 등록·기록 승인 → 창출 사회적 가치 KPI, ESG 경영 보고서(CSV·PDF)</span>
            </li>
          </ul>
          <div className="mt-5 flex gap-2">
            <Link className="button primary small" to="/signup">청년 회원가입</Link>
            <Link className="button small" to="/signup?type=org">기관 회원가입</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Support() {
  const [params] = useSearchParams();
  const tab = params.get('tab') ?? 'notice';
  const titles: Record<string, string> = { notice: '공지사항', faq: '자주 묻는 질문', guide: '이용 가이드' };
  return (
    <SubPage section="support" title={titles[tab] ?? '고객지원'} desc="GreenStep 이용에 필요한 안내를 모았습니다.">
      {tab === 'faq' ? <Faqs /> : tab === 'guide' ? <Guide /> : <Notices openId={params.get('id')} />}
    </SubPage>
  );
}
