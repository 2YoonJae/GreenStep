import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import {
  REGION_CODE,
  REGIONS,
  regionOfCode,
  type ActivityDetailsInput,
  type ActivityInput,
  type Category,
  type Region,
} from '../../data/types';
import { SubPage } from '../../components/SubPage';
import { RequireApprovedOrg } from '../../components/Guards';
import { ErrorBox, Loading } from '../../components/ui';
import { errorMessage } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { judgeDifficulty } from '../../lib/difficulty';
import { CATEGORY_META, CATEGORIES, rateOf, socialValue, WEIGHT_RULES } from '../../lib/sroi';
import { today, won } from '../../lib/format';

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** 기관 주소 "서울 마포구 배움길 34" → 시·도 '서울', 지역명 '서울 마포구' (첫 입력 기본값) */
function guessRegion(address: string): { region: Region; regionName: string } {
  const [first = '', second = ''] = address.trim().split(/\s+/);
  const region = REGIONS.find((r) => first.startsWith(r)) ?? '서울';
  return { region, regionName: region && second ? `${region} ${second}` : region };
}

/**
 * 공고 등록 폼 — 입력 칸이 테이블 컬럼과 1:1 로 대응합니다.
 *   activities       : title · category · description · recruit_start_date · recruit_end_date · capacity
 *                      activity_start_date · activity_end_date · region_code · region_name · address · status
 *   activity_details : summary · hours_per_session · target_group · tasks · individual_support
 * 서버가 정하는 값: activity_id · organization_id · source_type(GREENSTEP) · external_* · applicant_count ·
 *                   weight · weight_status · difficulty_reason · view_count · created_at · updated_at
 */
function Body() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { session } = useAuth();
  const org = session!.org!;
  const navigate = useNavigate();
  const notify = useToast();
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState<{ applicantCount: number; confirmed: boolean; recruiting: boolean }>({ applicantCount: 0, confirmed: false, recruiting: false });
  const start = guessRegion(org.address);
  const [f, setF] = useState<ActivityInput>({
    title: '', description: '', category: 'care',
    recruitStartDate: today(), recruitEndDate: addDays(today(), 7), capacity: 10,
    activityStartDate: addDays(today(), 14), activityEndDate: addDays(today(), 28),
    regionCode: REGION_CODE[start.region], regionName: start.regionName, address: org.address,
    status: 'RECRUITING',
    details: { summary: '', hoursPerSession: 3, targetGroup: '', tasks: '', individualSupport: false },
  });

  useEffect(() => {
    if (!id) return;
    api.org
      .activity(id)
      .then((a) => {
        setF({
          title: a.title, description: a.description, category: a.category,
          recruitStartDate: a.recruitStartDate, recruitEndDate: a.recruitEndDate, capacity: a.capacity,
          activityStartDate: a.activityStartDate, activityEndDate: a.activityEndDate,
          regionCode: a.regionCode, regionName: a.regionName, address: a.address,
          status: a.status === 'DRAFT' ? 'DRAFT' : 'RECRUITING',
          details: {
            summary: a.summary, hoursPerSession: a.hoursPerSession, targetGroup: a.targetGroup, tasks: a.tasks,
            individualSupport: a.individualSupport,
          },
        });
        setLocked({ applicantCount: a.applicantCount, confirmed: a.weightStatus === 'CONFIRMED', recruiting: a.status === 'RECRUITING' });
      })
      .catch((e) => setLoadError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading />;
  if (loadError) return <ErrorBox message={loadError} />;

  const set = <K extends keyof ActivityInput>(k: K, v: ActivityInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const setD = <K extends keyof ActivityDetailsInput>(k: K, v: ActivityDetailsInput[K]) => setF((p) => ({ ...p, details: { ...p.details, [k]: v } }));
  const d = f.details;
  const region = regionOfCode(f.regionCode);
  const judge = judgeDifficulty(d);
  const keepConfirmed = locked.confirmed && judge.candidate;
  const weightNow = keepConfirmed ? 1.2 : 1;
  const value = socialValue(d.hoursPerSession, rateOf(f.category), weightNow);

  /** 시·도를 바꾸면 지역명의 시·도 부분도 맞춰 줌 */
  const changeRegion = (r: Region) => {
    const prev = region && f.regionName.startsWith(region) ? f.regionName.slice(region.length).trim() : '';
    setF((p) => ({ ...p, regionCode: REGION_CODE[r], regionName: prev ? `${r} ${prev}` : r }));
  };

  const save = async (status: ActivityInput['status']) => {
    setError('');
    if (!f.title.trim()) return setError('활동명을 입력해 주세요.');
    if (f.recruitStartDate > f.recruitEndDate) return setError('모집 시작일은 모집 마감일 이전이어야 합니다.');
    if (f.activityStartDate > f.activityEndDate) return setError('활동 종료일은 활동 시작일 이후여야 합니다.');
    if (f.recruitEndDate > f.activityEndDate) return setError('모집 마감일은 활동 종료일 이전이어야 합니다.');
    if (!f.regionName.trim()) return setError('지역명을 입력해 주세요.');
    if (!d.targetGroup.trim() || !d.tasks.trim()) return setError('대상자와 수행 업무를 입력해 주세요. 가중치 판단에 사용됩니다.');
    setBusy(true);
    try {
      const input: ActivityInput = { ...f, status };
      if (editing) await api.org.updateActivity(id!, input);
      else await api.org.createActivity(input);
      notify(status === 'DRAFT' ? '임시저장했습니다. 기관에게만 보입니다.' : editing ? '공고를 수정했습니다.' : '공고를 게시했습니다.');
      navigate('/org/activities');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save('RECRUITING');
  };

  return (
    <form className="grid gap-10" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px' }} onSubmit={submit} noValidate>
      <div className="flex flex-col gap-8">
        {/* ───── activities ───── */}
        <section className="form-grid">
          <h2 className="wide text-lg font-bold">기본 정보</h2>
          <div className="field wide">
            <label htmlFor="a-title">활동명<span className="req">*</span></label>
            <input id="a-title" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={255} placeholder="예) 방과후 아동 1:1 학습 돌봄" />
          </div>
          <div className="field wide">
            <label htmlFor="a-cat">활동 분야<span className="req">*</span></label>
            <select id="a-cat" value={f.category} onChange={(e) => set('category', e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_META[c].label} · 단가 {won(CATEGORY_META[c].rate)}원</option>
              ))}
            </select>
          </div>
          <div className="field wide">
            <label htmlFor="a-desc">활동 내용</label>
            <textarea id="a-desc" rows={5} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="일정, 준비물, 오리엔테이션 등" />
          </div>
        </section>

        <section className="form-grid">
          <h2 className="wide text-lg font-bold">모집</h2>
          <div className="field">
            <label htmlFor="a-rstart">모집 시작일<span className="req">*</span></label>
            <input id="a-rstart" type="date" max={f.recruitEndDate} value={f.recruitStartDate} onChange={(e) => set('recruitStartDate', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-rend">모집 마감일<span className="req">*</span></label>
            <input id="a-rend" type="date" min={f.recruitStartDate} max={f.activityEndDate} value={f.recruitEndDate} onChange={(e) => set('recruitEndDate', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-cap">모집 정원<span className="req">*</span></label>
            <input id="a-cap" type="number" min={Math.max(1, locked.applicantCount)} max={500} value={f.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />
            {locked.applicantCount > 0 && <p className="help">현재 신청 {locked.applicantCount}명 · 그보다 적게 줄일 수 없습니다</p>}
          </div>
        </section>

        <section className="form-grid">
          <h2 className="wide text-lg font-bold">활동 기간</h2>
          <div className="field">
            <label htmlFor="a-start">활동 시작일<span className="req">*</span></label>
            <input id="a-start" type="date" value={f.activityStartDate} onChange={(e) => set('activityStartDate', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-end">활동 종료일<span className="req">*</span></label>
            <input id="a-end" type="date" min={f.activityStartDate} value={f.activityEndDate} onChange={(e) => set('activityEndDate', e.target.value)} />
          </div>
        </section>

        <section className="form-grid">
          <h2 className="wide text-lg font-bold">활동 장소</h2>
          <div className="field">
            <label htmlFor="a-region">시·도<span className="req">*</span></label>
            <select id="a-region" value={region ?? ''} onChange={(e) => changeRegion(e.target.value as Region)}>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <p className="help">지역 코드 {f.regionCode}</p>
          </div>
          <div className="field">
            <label htmlFor="a-rname">지역명<span className="req">*</span></label>
            <input id="a-rname" value={f.regionName} onChange={(e) => set('regionName', e.target.value)} maxLength={100} placeholder="예) 서울 마포구" />
          </div>
          <div className="field wide">
            <label htmlFor="a-addr">상세 주소</label>
            <input id="a-addr" value={f.address} onChange={(e) => set('address', e.target.value)} maxLength={255} placeholder="실제 봉사 장소 주소" />
          </div>
        </section>

        {/* ───── activity_details ───── */}
        <section className="form-grid">
          <div className="wide">
            <h2 className="text-lg font-bold">공고 상세 · 사회적 가치 산정 정보</h2>
            <p className="mt-1 text-[14px] text-muted">회당 시간으로 1회 사회적 가치를 계산하고, 대상자 · 수행 업무 · 1:1 지원 여부로 직무 난이도 가중치(+0.2) 후보를 자동 분류합니다. 가중치 값은 운영자가 확인 후 설정하며 기관은 직접 정할 수 없습니다.</p>
          </div>
          <div className="field wide">
            <label htmlFor="a-summary">한 줄 소개</label>
            <input id="a-summary" value={d.summary} onChange={(e) => setD('summary', e.target.value)} maxLength={80} placeholder="목록 카드에 보이는 짧은 소개" />
          </div>
          <div className="field">
            <label htmlFor="a-hours">회당 활동 시간<span className="req">*</span></label>
            <input id="a-hours" type="number" min={0.5} max={12} step={0.5} value={d.hoursPerSession} onChange={(e) => setD('hoursPerSession', Number(e.target.value))} />
            <p className="help">0.5 ~ 12시간</p>
          </div>
          <div className="field">
            <label htmlFor="a-target">대상자<span className="req">*</span></label>
            <input id="a-target" value={d.targetGroup} onChange={(e) => setD('targetGroup', e.target.value)} maxLength={100} placeholder="예) 초등 저학년 아동, 독거 어르신" />
          </div>
          <div className="field wide">
            <label htmlFor="a-tasks">수행 업무<span className="req">*</span></label>
            <input id="a-tasks" value={d.tasks} onChange={(e) => setD('tasks', e.target.value)} maxLength={200} placeholder="예) 1:1 학습지도, 정서 지원" />
          </div>
          <label className="check wide">
            <input type="checkbox" checked={d.individualSupport} onChange={(e) => setD('individualSupport', e.target.checked)} />
            봉사자 한 명이 대상자 한 명을 개별(1:1)로 지원하는 활동입니다.
          </label>
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="button primary" disabled={busy}>{editing ? '저장하고 게시' : '게시하기'}</button>
          <button type="button" className="button" disabled={busy || (locked.recruiting && locked.applicantCount > 0)} onClick={() => save('DRAFT')}>
            임시저장
          </button>
          <Link className="button" to="/org/activities">취소</Link>
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="panel" style={{ position: 'sticky', top: 16 }}>
          <p className="text-[14px] font-bold">미리보기</p>
          <p className="mt-3 font-bold">{f.title || '활동명'}</p>
          <p className="text-[13px] text-muted">{org.name} · {f.regionName || '지역명'}</p>
          {d.summary && <p className="mt-1 text-[13px] text-body">{d.summary}</p>}

          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[14px] font-bold">직무 난이도 자동 분류</p>
            <div className="mt-2">
              {keepConfirmed ? (
                <span className="st st-green">운영자 확정 · 가중치 1.2 유지</span>
              ) : judge.candidate ? (
                <span className="st st-warn">가중치 적용 후보</span>
              ) : (
                <span className="st st-gray">해당 없음</span>
              )}
            </div>
            <p className="mt-2 text-[13px] text-body">{judge.reason}</p>
            <ul className="mt-2 text-[13px] text-muted">
              <li>{judge.checks.target ? '✓' : '·'} 지원이 필요한 대상</li>
              <li>{judge.checks.direct ? '✓' : '·'} 직접 지원 업무</li>
              <li>{judge.checks.individual ? '✓' : '·'} 1:1 개별 지원</li>
            </ul>
            {locked.confirmed && !judge.candidate && <p className="mt-2 text-[13px] text-danger">내용이 바뀌어 운영자 확정이 해제되고 가중치가 1.0으로 돌아갑니다.</p>}
          </div>

          <div className="calc-result">
            <div className="calc-result-top">
              <span>1회 예상 사회적 가치</span>
              <output>
                {won(value)}
                <small> 원</small>
              </output>
            </div>
            <p className="calc-formula">
              {d.hoursPerSession}시간 × {won(rateOf(f.category))}원 × {weightNow.toFixed(1)}
              {judge.candidate && !keepConfirmed && ` · 운영자 확인 시 ×${(1 + WEIGHT_RULES.difficulty.add).toFixed(1)}`}
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}

export default function ActivityForm() {
  const { id } = useParams();
  return (
    <SubPage section="orgActivities" title={id ? '공고 수정' : '새 공고 등록'} desc="봉사활동 모집 공고를 작성합니다. 임시저장한 공고는 기관에게만 보입니다.">
      <RequireApprovedOrg>
        <Body />
      </RequireApprovedOrg>
    </SubPage>
  );
}
