import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { AiSection, CsrReport, ReportSections, ReportSnapshot, ReportTheme } from '../../data/types';
import { SubPage } from '../../components/SubPage';
import { RequireApprovedOrg } from '../../components/Guards';
import { Icon } from '../../components/Icon';
import { BarChart, Empty, ErrorBox, Kpis, Loading } from '../../components/ui';
import { errorMessage, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { downloadCsv } from '../../lib/csv';
import { fillPlaceholders, PLACEHOLDERS } from '../../lib/placeholders';
import { dateDot, num, pct, won } from '../../lib/format';
import { BASE_RATE, CARE_RATE, CATEGORY_META } from '../../lib/sroi';

const THEMES: [ReportTheme, string, string][] = [
  ['teal', '청록', '#0f766e'],
  ['green', '초록', '#2f7d32'],
  ['navy', '남색', '#1f3a68'],
];
const SECTION_LABEL: Record<keyof ReportSections, string> = {
  greeting: '인사말',
  intro: '기관 소개',
  highlights: '주요 활동과 성과',
  plan: '내년 계획',
};
const STATUS_LABEL = { DRAFT: ['작성 중', 'st-gray'], PAID: ['결제 완료', 'st-blue'], PUBLISHED: ['발행 완료', 'st-green'] } as const;

/* ───────── A4 보고서 문서 ───────── */

function ReportDoc({ report, snap, orgAddress }: { report: CsrReport; snap: ReportSnapshot; orgAddress: string }) {
  const preview = report.status !== 'PUBLISHED';
  const text = (k: keyof ReportSections) => fillPlaceholders(report.sections[k], snap).trim();
  const has = (k: keyof ReportSections) => text(k).length > 0; // 빈 섹션 자동 제외
  const wm = preview && (
    <div className="watermark" aria-hidden="true">
      <span>미리보기 · PREVIEW</span>
    </div>
  );
  const footer = (
    <p className="absolute right-[18mm] bottom-[10mm] left-[18mm] flex justify-between text-[10px] text-muted">
      <span>{snap.orgName} · {snap.year} ESG 경영 보고서 · v{report.version}</span>
      <span>{report.confirmNo ? `확인번호 ${report.confirmNo} · GreenStep /verify 에서 조회` : '발행 전 미리보기 — 확인번호 없음'}</span>
    </p>
  );

  return (
    <>
      <article className="doc" data-theme={report.theme}>
        {wm}
        <div className="doc-band">
          <p style={{ fontSize: 12, letterSpacing: 3, opacity: 0.85 }}>{snap.year} ESG MANAGEMENT REPORT</p>
          <h1 style={{ fontSize: 34, marginTop: 8 }}>{snap.year} ESG 경영 보고서</h1>
          <p style={{ fontSize: 16, marginTop: 6, fontWeight: 700 }}>{snap.orgName}</p>
          <p style={{ fontSize: 11, marginTop: 14, opacity: 0.85 }}>
            {orgAddress} · 아래 수치는 GreenStep 산정값입니다
          </p>
        </div>
        <div className="doc-kpis" style={{ marginTop: 18 }}>
          <div><p>창출 사회적 가치</p><strong>{won(snap.totalValue)}원</strong></div>
          <div><p>봉사 시간</p><strong>{num(snap.totalHours)}시간</strong></div>
          <div><p>참여 청년</p><strong>{num(snap.youthCount)}명</strong></div>
          <div><p>기관 승인률</p><strong>{pct(snap.approvalRate)}</strong></div>
        </div>
        {has('greeting') && (
          <>
            <h2>{SECTION_LABEL.greeting}</h2>
            <p className="whitespace-pre-line">{text('greeting')}</p>
          </>
        )}
        {has('intro') && (
          <>
            <h2>{SECTION_LABEL.intro}</h2>
            <p className="whitespace-pre-line">{text('intro')}</p>
          </>
        )}
        <h2>한눈에 보는 {snap.year}년</h2>
        <p>
          {snap.year}년 {snap.orgName}에서는 {snap.activityCount}개 활동에 청년 {num(snap.youthCount)}명이 참여해 총 {num(snap.totalHours)}시간의 봉사가 이루어졌습니다. 기관이 승인한 {num(snap.approvedCount)}건의 기록을
          사회적 가치로 환산하면 {won(snap.totalValue)}원입니다.
        </p>
        {footer}
      </article>

      <article className="doc" data-theme={report.theme}>
        {wm}
        <h2 style={{ marginTop: 0 }}>월별 사회적 가치 추이</h2>
        {snap.monthly.length > 0 ? (
          <BarChart data={snap.monthly.map((m) => ({ label: `${m.month}월`, value: m.value }))} format={(v) => `${Math.round(v / 1000) / 10}만`} />
        ) : (
          <p className="text-muted">월별 자료 없음</p>
        )}
        {snap.monthly.length > 0 && (
          <table className="table mt-3">
            <thead>
              <tr><th>월</th><th className="num">기록</th><th className="num">참여 청년</th><th className="num">시간</th><th className="num">사회적 가치</th></tr>
            </thead>
            <tbody>
              {snap.monthly.filter((m) => m.records > 0).map((m) => (
                <tr key={m.month}><td>{m.month}월</td><td className="num">{m.records}건</td><td className="num">{m.youth}명</td><td className="num">{num(m.hours)}</td><td className="num">{won(m.value)}원</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {snap.byActivity.length > 0 && (
          <>
            <h2>활동별 성과</h2>
            <table className="table">
              <thead>
                <tr><th>활동</th><th>분야</th><th className="num">참여 청년</th><th className="num">시간</th><th className="num">사회적 가치</th></tr>
              </thead>
              <tbody>
                {snap.byActivity.map((a) => (
                  <tr key={a.title}><td>{a.title}</td><td>{CATEGORY_META[a.category].label}</td><td className="num">{a.youth}명</td><td className="num">{num(a.hours)}</td><td className="num">{won(a.value)}원</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {has('highlights') && (
          <>
            <h2>{SECTION_LABEL.highlights}</h2>
            <p className="whitespace-pre-line">{text('highlights')}</p>
          </>
        )}
        {has('plan') && (
          <>
            <h2>{SECTION_LABEL.plan}</h2>
            <p className="whitespace-pre-line">{text('plan')}</p>
          </>
        )}
        <h2>산정 기준과 검증 절차</h2>
        <p>
          사회적 가치(원) = 활동 시간 × 표준 단가 × 기관 가중치(1.0~1.5). 표준 단가는 2026년 최저임금 {won(BASE_RATE)}원, 돌봄·보육 {won(CARE_RATE)}원이며, 가중치는 직무 난이도(+0.2)만 적용했습니다. 단가·가중치는 기록 제출 시점 값으로 고정됩니다.
          청년이 제출한 기록을 {snap.orgName}이 확인해 승인한 건만 집계했으며(승인 {num(snap.approvedCount)}건 · 반려 {num(snap.rejectedCount)}건), 봉사자 개인정보는 싣지 않고 인원수만 표시했습니다.
          이 수치는 GreenStep 산정값입니다.
        </p>
        <p className="mt-2 text-[11px] text-muted">
          집계 기준 시각 {dateDot(snap.generatedAt)} {report.publishedAt ? `· 발행 ${dateDot(report.publishedAt)} (발행 시점 스냅샷 고정)` : '· 발행 전 실시간 집계'}
        </p>
        {footer}
      </article>
    </>
  );
}

/* ───────── 편집기 ───────── */

function Editor({ report, onChange }: { report: CsrReport; onChange: (r: CsrReport) => void }) {
  const notify = useToast();
  const editable = report.status !== 'PUBLISHED';
  const [sections, setSections] = useState(report.sections);
  const [memo, setMemo] = useState<Record<AiSection, string>>({ greeting: '', intro: '' });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setSections(report.sections);
  }, [report.id, report.sections]);

  const saveSection = async (k: keyof ReportSections) => {
    if (sections[k] === report.sections[k]) return;
    try {
      onChange(await api.reports.update(report.id, { sections: { [k]: sections[k] } }));
    } catch (e) {
      notify(errorMessage(e));
    }
  };
  const ai = async (k: AiSection) => {
    setBusy(k);
    try {
      const { report: r } = await api.reports.aiDraft(report.id, k, memo[k]);
      onChange(r);
      notify(`${SECTION_LABEL[k]} 초안을 만들었습니다. (${r.aiUsage[k]}/3회) 숫자는 집계값으로 자동 채워집니다.`);
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-[15px] font-bold">테마 색상</p>
        <div className="flex gap-2">
          {THEMES.map(([t, label, color]) => (
            <button
              key={t}
              type="button"
              className="button small"
              aria-pressed={report.theme === t}
              disabled={!editable}
              style={report.theme === t ? { borderColor: color, color, fontWeight: 700, background: 'var(--white)' } : undefined}
              onClick={async () => onChange(await api.reports.update(report.id, { theme: t }))}
            >
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="alert">
        <Icon name="info" small />
        <p className="text-[13px]">
          숫자는 직접 쓰지 말고 자리 표시를 쓰세요: {PLACEHOLDERS.map((p) => <code key={p} className="mx-1 rounded bg-white px-1">{p}</code>)} — 서버 집계값으로 채워집니다. 비워 둔 섹션은 보고서에서 자동으로 빠집니다.
        </p>
      </div>
      {(Object.keys(SECTION_LABEL) as (keyof ReportSections)[]).map((k) => {
        const isAi = k === 'greeting' || k === 'intro';
        return (
          <div key={k} className="field">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor={`sec-${k}`} style={{ margin: 0 }}>
                {SECTION_LABEL[k]}
                <span className="ml-2 text-[12px] font-normal text-muted">{isAi ? 'AI 초안 가능' : '기관 입력'}</span>
              </label>
            </div>
            <textarea id={`sec-${k}`} rows={isAi ? 5 : 4} value={sections[k]} disabled={!editable} onChange={(e) => setSections({ ...sections, [k]: e.target.value })} onBlur={() => saveSection(k)} />
            {isAi && editable && (
              <div className="mt-2 flex gap-2">
                <input
                  aria-label={`${SECTION_LABEL[k]} 담당자 메모`}
                  style={{ minHeight: 40, fontSize: 14 }}
                  placeholder="담당자 메모 (선택) — 예) 올해 처음 청년 봉사단을 운영함"
                  value={memo[k as AiSection]}
                  maxLength={300}
                  onChange={(e) => setMemo({ ...memo, [k]: e.target.value })}
                />
                <button type="button" className="button small secondary whitespace-nowrap" disabled={busy !== null || report.aiUsage[k as AiSection] >= 3} onClick={() => ai(k as AiSection)}>
                  <Icon name="sparkle" small />
                  {busy === k ? '작성 중…' : `AI 초안 (${3 - report.aiUsage[k as AiSection]}회 남음)`}
                </button>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-[12px] text-muted">AI 초안에는 기관 정보와 담당자 메모만 사용하며, 청년 개인정보는 보내지 않습니다. AI 모델은 미정이며 현재는 목업 문장입니다.</p>
    </div>
  );
}

/* ───────── 페이지 ───────── */

function Body() {
  const { session } = useAuth();
  const org = session!.org!;
  const notify = useToast();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const summary = useAsync(() => api.reports.summary(year), [year]);
  const reports = useAsync(() => api.reports.list(), []);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const yearReports = (reports.data ?? []).filter((r) => r.year === year);
  const current = yearReports.find((r) => r.id === currentId) ?? yearReports.find((r) => r.status !== 'PUBLISHED') ?? yearReports[0] ?? null;

  const replace = (r: CsrReport) => {
    reports.setData((list) => {
      const rest = (list ?? []).filter((x) => x.id !== r.id);
      return [r, ...rest].sort((a, b) => b.year - a.year || b.version - a.version);
    });
    setCurrentId(r.id);
  };
  const run = async (fn: () => Promise<CsrReport>, msg: string) => {
    setBusy(true);
    try {
      replace(await fn());
      notify(msg);
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const exportMonthly = (s: ReportSnapshot) =>
    downloadCsv(
      `${s.orgName}_${s.year}_월별집계.csv`,
      ['월', '승인 기록(건)', '참여 청년(명)', '봉사 시간', '사회적 가치(원)'],
      s.monthly.map((m) => [`${m.month}월`, m.records, m.youth, m.hours, m.value]),
    );
  const exportActivity = (s: ReportSnapshot) =>
    downloadCsv(
      `${s.orgName}_${s.year}_활동별성과.csv`,
      ['활동', '분야', '참여 청년(명)', '봉사 시간', '사회적 가치(원)'],
      s.byActivity.map((a) => [a.title, CATEGORY_META[a.category].label, a.youth, a.hours, a.value]),
    );

  const s = summary.data;
  const docSnap = current?.status === 'PUBLISHED' && current.snapshot ? current.snapshot : s;

  return (
    <div className="flex flex-col gap-8">
      <div className="no-print flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label htmlFor="rep-year" className="font-bold">보고 연도</label>
          <select id="rep-year" className="w-auto" style={{ minHeight: 44 }} value={year} onChange={(e) => { setYear(Number(e.target.value)); setCurrentId(null); }}>
            {[thisYear, thisYear - 1].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
        {s && (
          <div className="flex gap-2">
            <button className="button small" onClick={() => exportMonthly(s)}><Icon name="download" small />월별 집계 CSV</button>
            <button className="button small" onClick={() => exportActivity(s)} disabled={s.byActivity.length === 0}><Icon name="download" small />활동별 성과 CSV</button>
          </div>
        )}
      </div>

      {summary.loading && !s && <Loading />}
      {summary.error && <ErrorBox message={summary.error} onRetry={summary.reload} />}
      {s && (
        <div className="no-print flex flex-col gap-6">
          <Kpis
            items={[
              { label: '창출 사회적 가치', value: won(s.totalValue), unit: '원', note: 'GreenStep 산정값' },
              { label: '봉사 시간', value: num(s.totalHours), unit: '시간' },
              { label: '참여 청년', value: num(s.youthCount), unit: '명', note: '개인정보 없이 인원수만' },
              { label: '기관 승인률', value: pct(s.approvalRate), unit: '', note: `승인 ${s.approvedCount} · 반려 ${s.rejectedCount}` },
            ]}
          />
          <section className="panel">
            <div className="panel-title">
              <h2>월별 사회적 가치</h2>
              <small>{year}년 · 승인 기록 기준 실시간 집계</small>
            </div>
            <BarChart data={s.monthly.map((m) => ({ label: `${m.month}월`, value: m.value }))} format={(v) => `${Math.round(v / 1000) / 10}만`} />
          </section>
        </div>
      )}

      <section className="panel no-print">
        <div className="panel-title">
          <h2>ESG 경영 보고서 발행</h2>
          <small>A4 PDF · 템플릿 1종 · 테마 3색</small>
        </div>
        <ol className="mb-5 grid grid-cols-4 gap-2 text-[14px]">
          {['① 내용 작성·미리보기', '② 결제 완료 (데모)', '③ 발행 · 확인번호 발급', '④ PDF 저장·진위 조회'].map((t, i) => {
            const step = !current ? 0 : current.status === 'DRAFT' ? 0 : current.status === 'PAID' ? 1 : 3;
            return (
              <li key={t} className={`rounded-md border px-3 py-2 ${i <= step ? 'border-primary bg-soft font-bold text-hover' : 'border-line text-muted'}`}>
                {t}
              </li>
            );
          })}
        </ol>
        {reports.loading && !reports.data && <Loading />}
        {reports.data && yearReports.length === 0 && (
          <Empty title={`${year}년 보고서가 아직 없습니다`}>
            <p>승인된 기록을 자동 집계하고, 인사말·기관 소개 등은 직접 입력하거나 AI 초안을 받을 수 있습니다.</p>
            <button className="button primary" disabled={busy} onClick={() => run(() => api.reports.create(year), '보고서 작성을 시작했습니다.')}>
              보고서 작성 시작
            </button>
          </Empty>
        )}
        {yearReports.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {yearReports.map((r) => (
              <button key={r.id} className="button small" aria-pressed={current?.id === r.id} style={current?.id === r.id ? { borderColor: 'var(--primary)', background: 'var(--soft)' } : undefined} onClick={() => setCurrentId(r.id)}>
                v{r.version} <span className={`st ${STATUS_LABEL[r.status][1]}`}>{STATUS_LABEL[r.status][0]}</span>
                {r.confirmNo && <span className="text-[12px] text-muted">{r.confirmNo}</span>}
              </button>
            ))}
          </div>
        )}
        {current && (
          <div className="grid gap-8" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
            <Editor report={current} onChange={replace} />
            <aside className="flex flex-col gap-3">
              <div className="rounded-lg bg-surface p-4 text-[14px]">
                <p className="font-bold">v{current.version} · {STATUS_LABEL[current.status][0]}</p>
                {current.confirmNo && (
                  <p className="mt-2">
                    확인번호 <strong className="text-[16px]">{current.confirmNo}</strong>
                  </p>
                )}
                {current.publishedAt && <p className="text-muted">발행 {dateDot(current.publishedAt)} · 집계 스냅샷 고정</p>}
                {current.status === 'DRAFT' && <p className="mt-1 text-muted">워터마크가 있는 미리보기입니다. 결제 후 발행할 수 있습니다.</p>}
              </div>
              {current.status === 'DRAFT' && (
                <button className="button primary" disabled={busy} onClick={() => run(() => api.reports.markPaid(current.id), '결제 완료 처리했습니다. (데모 · 실결제 없음)')}>
                  결제 완료 (데모)
                </button>
              )}
              {current.status === 'PAID' && (
                <button
                  className="button green"
                  disabled={busy || (s?.approvedCount ?? 0) === 0}
                  onClick={() => confirm('발행하면 현재 집계가 스냅샷으로 고정되고 확인번호가 발급됩니다. 이후 수정은 새 버전으로만 가능합니다. 발행할까요?') && run(() => api.reports.publish(current.id), '보고서를 발행했습니다.')}
                >
                  발행하고 확인번호 받기
                </button>
              )}
              {current.status === 'PUBLISHED' && (
                <>
                  <button className="button primary" onClick={() => window.print()}><Icon name="print" />PDF 저장·인쇄</button>
                  <button className="button" disabled={busy} onClick={() => run(() => api.reports.newVersion(current.id), `v${current.version + 1} 새 버전을 만들었습니다. 발행하면 새 확인번호가 부여됩니다.`)}>
                    수정하기 (새 버전)
                  </button>
                </>
              )}
              {current.status !== 'PUBLISHED' && (
                <button className="button" onClick={() => window.print()}><Icon name="print" />미리보기 인쇄</button>
              )}
              <p className="text-[12px] text-muted">PDF 저장: 인쇄 → PDF로 저장, 용지 A4, 여백 없음, 배경 그래픽 체크.</p>
            </aside>
          </div>
        )}
      </section>

      {current && docSnap && (
        <section>
          <h2 className="no-print mb-3 text-lg font-bold">{current.status === 'PUBLISHED' ? '발행본' : '미리보기'}</h2>
          <div className="rounded-lg bg-surface py-8 print:bg-transparent print:py-0">
            <ReportDoc report={current} snap={docSnap} orgAddress={org.address} />
          </div>
        </section>
      )}
    </div>
  );
}

export default function Reports() {
  return (
    <SubPage section="orgReports" title="ESG 경영 보고서" desc="승인된 봉사 기록을 자동 집계해 연간 ESG 경영 보고서를 만들고 확인번호와 함께 발행합니다.">
      <RequireApprovedOrg>
        <Body />
      </RequireApprovedOrg>
    </SubPage>
  );
}
