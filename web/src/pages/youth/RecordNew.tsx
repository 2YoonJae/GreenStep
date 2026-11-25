import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import type { Category } from '../../data/types';
import { SubPage } from '../../components/SubPage';
import { RequireRole } from '../../components/Guards';
import { Icon } from '../../components/Icon';
import { Empty, ErrorBox, Loading } from '../../components/ui';
import { errorMessage, useAsync } from '../../lib/useAsync';
import { useToast } from '../../lib/toast';
import { CATEGORY_META, CATEGORIES, hoursBetween, rateOf, socialValue } from '../../lib/sroi';
import { daysUntil, today, won } from '../../lib/format';

function Preview({ hours, rate, weight, external }: { hours: number; rate: number; weight: number; external?: boolean }) {
  return (
    <div className="calc-result" style={{ marginTop: 0 }}>
      <div className="calc-result-top">
        <span>{external ? '검증 후 반영될 사회적 가치' : '승인 시 반영될 사회적 가치'}</span>
        <output>
          {hours > 0 ? won(socialValue(hours, rate, weight)) : '—'}
          <small> 원</small>
        </output>
      </div>
      <p className="calc-formula">
        {hours > 0 ? `${hours}시간 × ${won(rate)}원 × ${weight.toFixed(1)}` : '시작·종료 시간을 입력하면 계산됩니다 (0.5시간 단위)'}
        <br />
        제출 시점의 단가와 가중치로 고정됩니다.
      </p>
    </div>
  );
}

function GreenStepForm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const notify = useToast();
  const apps = useAsync(() => api.applications.mine(), []);
  const [activityId, setActivityId] = useState(params.get('activity') ?? '');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('12:00');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (apps.loading) return <Loading />;
  if (apps.error) return <ErrorBox message={apps.error} />;
  const eligible = apps.data!.filter((ap) => daysUntil(ap.activity.activityStartDate) <= 0);
  if (eligible.length === 0)
    return (
      <Empty title="기록을 제출할 수 있는 활동이 없습니다">
        <p>신청한 활동이 시작된 뒤에 기록을 제출할 수 있습니다. 1365에서 한 활동은 「외부(1365) 활동」을 선택하세요.</p>
        <Link className="button" to="/activities">활동 찾기</Link>
      </Empty>
    );

  const sel = eligible.find((ap) => ap.activity.id === activityId)?.activity;
  const hours = hoursBetween(start, end);
  const maxDate = sel ? (sel.activityEndDate < today() ? sel.activityEndDate : today()) : today();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!sel) return setError('활동을 선택해 주세요.');
    if (!date) return setError('활동 날짜를 선택해 주세요.');
    if (hours <= 0) return setError('종료 시간은 시작 시간보다 늦어야 합니다.');
    setBusy(true);
    try {
      await api.participations.submit({ activityId: sel.id, date, startTime: start, endTime: end, note });
      notify('기록을 제출했습니다. 기관 승인 후 반영됩니다.');
      navigate('/me/records');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="grid gap-8" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px' }} onSubmit={submit} noValidate>
      <div className="form-grid">
        <div className="field wide">
          <label htmlFor="r-act">활동 선택<span className="req">*</span></label>
          <select id="r-act" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
            <option value="">신청한 활동 중 선택</option>
            {eligible.map((ap) => (
              <option key={ap.id} value={ap.activity.id}>
                {ap.activity.title} · {ap.activity.orgName}
              </option>
            ))}
          </select>
          {sel && <p className="help">활동 기간 {sel.activityStartDate} ~ {sel.activityEndDate} · {CATEGORY_META[sel.category].label} · 가중치 {sel.weight.toFixed(1)}</p>}
        </div>
        <div className="field">
          <label htmlFor="r-date">활동 날짜<span className="req">*</span></label>
          <input id="r-date" type="date" value={date} min={sel?.activityStartDate} max={maxDate} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label htmlFor="r-start">시작<span className="req">*</span></label>
            <input id="r-start" type="time" step={1800} value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="r-end">종료<span className="req">*</span></label>
            <input id="r-end" type="time" step={1800} value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="field wide">
          <label htmlFor="r-note">기관에 남길 메모</label>
          <textarea id="r-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="예) 배달까지 참여했습니다." maxLength={300} />
        </div>
        {error && <p className="form-error wide" role="alert">{error}</p>}
        <div className="wide flex gap-2">
          <button className="button primary" disabled={busy}>{busy ? '제출 중…' : '기록 제출'}</button>
          <Link className="button" to="/me/records">취소</Link>
        </div>
      </div>
      <aside>
        <Preview hours={hours} rate={sel ? rateOf(sel.category) : 10320} weight={sel?.weight ?? 1} />
        <p className="mt-3 text-[13px] text-muted">제출하면 「승인 대기(PENDING)」 상태가 되고, 주최 기관이 승인하면 이력서·누적 가치에 반영됩니다.</p>
      </aside>
    </form>
  );
}

function ExternalForm() {
  const navigate = useNavigate();
  const notify = useToast();
  const [f, setF] = useState({ activityTitle: '', orgName: '', category: 'care' as Category, date: '', startTime: '09:00', endTime: '12:00', note: '' });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const hours = hoursBetween(f.startTime, f.endTime);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!f.activityTitle.trim() || !f.orgName.trim()) return setError('활동명과 기관명을 입력해 주세요.');
    if (!f.date) return setError('활동 날짜를 선택해 주세요.');
    if (hours <= 0) return setError('종료 시간은 시작 시간보다 늦어야 합니다.');
    if (!file) return setError('1365 활동확인서를 첨부해 주세요.');
    if (file.size > 5 * 1024 * 1024) return setError('첨부 파일은 5MB 이하만 가능합니다.');
    setBusy(true);
    try {
      await api.participations.submitExternal({ ...f, certificate: file });
      notify('확인서를 제출했습니다. 검증 후 반영됩니다.');
      navigate('/me/records');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="grid gap-8" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px' }} onSubmit={submit} noValidate>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="x-title">활동명<span className="req">*</span></label>
          <input id="x-title" value={f.activityTitle} onChange={(e) => setF({ ...f, activityTitle: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="x-org">수요처(기관명)<span className="req">*</span></label>
          <input id="x-org" value={f.orgName} onChange={(e) => setF({ ...f, orgName: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="x-cat">활동 분야<span className="req">*</span></label>
          <select id="x-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_META[c].label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="x-date">활동 날짜<span className="req">*</span></label>
          <input id="x-date" type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="x-start">시작<span className="req">*</span></label>
          <input id="x-start" type="time" step={1800} value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="x-end">종료<span className="req">*</span></label>
          <input id="x-end" type="time" step={1800} value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />
        </div>
        <div className="field wide">
          <label htmlFor="x-file">1365 활동확인서<span className="req">*</span></label>
          <input id="x-file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <p className="help">PDF·JPG·PNG, 5MB 이하. 1365 자원봉사포털 → 나의 봉사 → 실적 확인서에서 발급할 수 있습니다.</p>
        </div>
        <div className="field wide">
          <label htmlFor="x-note">메모</label>
          <textarea id="x-note" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} />
        </div>
        {error && <p className="form-error wide" role="alert">{error}</p>}
        <div className="wide flex gap-2">
          <button className="button primary" disabled={busy}>{busy ? '제출 중…' : '확인서 제출'}</button>
          <Link className="button" to="/me/records">취소</Link>
        </div>
      </div>
      <aside>
        <Preview hours={hours} rate={rateOf(f.category)} weight={1} external />
        <div className="alert warn mt-3">
          <Icon name="info" small />
          <p className="text-[14px]">외부 활동은 「검증 대기」 상태로 저장되며, 검증이 끝나기 전에는 이력서·집계에 반영되지 않습니다. 외부 활동은 가중치 1.0을 적용합니다.</p>
        </div>
      </aside>
    </form>
  );
}

function Body() {
  const [mode, setMode] = useState<'gs' | 'ext'>('gs');
  return (
    <>
      <div className="seg mb-8" role="group" aria-label="기록 유형">
        <button type="button" aria-pressed={mode === 'gs'} onClick={() => setMode('gs')}>GreenStep 활동</button>
        <button type="button" aria-pressed={mode === 'ext'} onClick={() => setMode('ext')}>외부(1365) 활동</button>
      </div>
      {mode === 'gs' ? <GreenStepForm /> : <ExternalForm />}
    </>
  );
}

export default function RecordNew() {
  return (
    <SubPage section="resume" title="활동 기록 제출" desc="참여한 날짜와 시간을 남기면 주최 기관이 확인 후 승인합니다.">
      <RequireRole role="YOUTH">
        <Body />
      </RequireRole>
    </SubPage>
  );
}
