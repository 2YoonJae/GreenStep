import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { SubPage } from '../components/SubPage';
import { Icon } from '../components/Icon';
import { Calculator, ErrorBox, Loading, WeightBadge, ActivityStatusBadge } from '../components/ui';
import { errorMessage, useAsync } from '../lib/useAsync';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { useSaved } from '../lib/saved';
import { CATEGORY_META, rateOf, socialValue, WEIGHT_RULES } from '../lib/sroi';
import { dateDot, daysUntil, dday, period, won } from '../lib/format';

export default function ActivityDetail() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  const saved = useSaved();
  const { data: a, error, loading, reload } = useAsync(() => api.activities.get(id), [id, session?.role]);
  const [busy, setBusy] = useState(false);

  if (loading && !a) return <SubPage section="activities" title="활동 상세"><Loading /></SubPage>;
  if (error || !a) return <SubPage section="activities" title="활동 상세"><ErrorBox message={error ?? '활동을 찾을 수 없습니다.'} /></SubPage>;

  const left = daysUntil(a.recruitEndDate);
  const open = a.status === 'RECRUITING' && left >= 0;
  const full = a.applicantCount >= a.capacity;
  const value = socialValue(a.hoursPerSession, rateOf(a.category), a.weight);
  const mine = session?.role === 'ORG' && session.org?.id === a.organizationId;
  const ext = a.sourceType === '1365';

  const apply = async () => {
    if (!session) {
      navigate(`/login?next=${encodeURIComponent(`/activities/${a.id}`)}`);
      return;
    }
    setBusy(true);
    try {
      if (a.applied) {
        await api.applications.cancel(a.id);
        notify('신청을 취소했습니다.');
      } else {
        await api.applications.apply(a.id);
        notify('신청했습니다. 활동 후 마이페이지에서 기록을 제출하세요.');
      }
      reload();
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  let cta: ReactNode;
  if (a.sourceType === '1365') {
    cta = (
      <>
        <a className="button primary w-full" href={a.externalUrl ?? 'https://www.1365.go.kr'} target="_blank" rel="noreferrer">
          1365 원문에서 신청하기
          <Icon name="arrow" />
        </a>
        <p className="mt-3 text-[13px] text-muted">신청과 담당자 연락처 확인은 1365 자원봉사포털에서 합니다. 활동 후 1365 활동확인서를 「활동 기록 제출 → 외부(1365) 활동」으로 올리면 검증 후 사회적 가치로 반영됩니다.</p>
      </>
    );
  } else if (mine) {
    cta = (
      <Link className="button primary w-full" to={`/org/activities/${a.id}/edit`}>
        이 활동 수정하기
      </Link>
    );
  } else if (session?.role === 'ORG') {
    cta = <p className="text-[15px] text-muted">기관 계정은 활동을 신청할 수 없습니다.</p>;
  } else {
    cta = (
      <button className={`button w-full ${a.applied ? '' : 'primary'}`} disabled={busy || (!a.applied && (!open || full))} onClick={apply}>
        {a.applied ? '신청 취소' : !open ? '모집 마감' : full ? '정원 마감' : session ? '이 활동 신청하기' : '로그인하고 신청하기'}
      </button>
    );
  }

  return (
    <SubPage section="activities" title="활동 상세">
      <div className="grid gap-10" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px' }}>
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="st st-blue">{CATEGORY_META[a.category].label}</span>
            {a.sourceType === '1365' && <span className="st st-violet">1365 공고</span>}
            {mine && <ActivityStatusBadge status={a.status} />}
            <span className={`st ${open ? (left <= 3 ? 'st-danger' : 'st-green') : 'st-gray'}`}>{open ? `모집 중 · ${dday(a.recruitEndDate)}` : '모집 마감'}</span>
          </div>
          <h2 className="text-[28px] font-bold leading-snug">{a.title}</h2>
          {a.summary && <p className="mt-2 text-body">{a.summary}</p>}

          <dl className="detail-list">
            <div><dt>{ext ? '모집 기관' : '주최 기관'}</dt><dd>{a.orgName}</dd></div>
            <div><dt>활동 지역</dt><dd>{a.address ? `${a.regionName} · ${a.address}` : a.regionName}</dd></div>
            <div><dt>활동 기간</dt><dd>{period(a.activityStartDate, a.activityEndDate)}</dd></div>
            <div><dt>모집 기간</dt><dd>{dateDot(a.recruitStartDate)} ~ {dateDot(a.recruitEndDate)}</dd></div>
            <div><dt>모집 현황</dt><dd>{a.capacity > 0 ? `${a.applicantCount} / ${a.capacity}명` : `신청 ${a.applicantCount}명`}</dd></div>
            <div><dt>회당 활동 시간</dt><dd>{a.hoursPerSession}시간</dd></div>
            {ext ? (
              <div><dt>1365 분야</dt><dd>{a.sourceCategory || '—'}</dd></div>
            ) : (
              <>
                <div><dt>대상자</dt><dd>{a.targetGroup || '—'}</dd></div>
                <div><dt>수행 업무</dt><dd>{a.tasks || '—'}{a.individualSupport ? ' · 1:1 개별 지원' : ''}</dd></div>
              </>
            )}
          </dl>
          {ext && (
            <p className="mt-3 text-[13px] text-muted">
              출처: 행정안전부 1365 자원봉사포털 (공공데이터포털 「행정안전부_봉사참여정보서비스」) · 공고번호 {a.externalActivityId} · 2시간마다 갱신
            </p>
          )}

          {a.description && (
            <>
              <h3 className="mb-3 mt-8 text-lg font-bold">활동 내용</h3>
              <p className="whitespace-pre-line leading-relaxed text-body">{a.description}</p>
            </>
          )}

          <h3 className="mb-3 mt-8 text-lg font-bold">사회적 가치 산정 기준</h3>
          <div className="panel">
            <div className="flex flex-wrap items-center gap-2">
              <WeightBadge status={a.weightStatus} weight={a.weight} />
              {a.difficultyReason && <span className="text-[14px] text-muted">{a.difficultyReason}</span>}
            </div>
            <table className="table mt-4">
              <thead>
                <tr>
                  <th>가산 항목</th>
                  <th className="num">가산</th>
                  <th>적용</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(WEIGHT_RULES) as (keyof typeof WEIGHT_RULES)[]).map((k) => (
                  <tr key={k}>
                    <td>{WEIGHT_RULES[k].label}</td>
                    <td className="num">+{WEIGHT_RULES[k].add}</td>
                    <td>
                      {!WEIGHT_RULES[k].active ? (
                        <span className="text-muted">기준 확정 전 (보류)</span>
                      ) : a.weightFlags[k] ? (
                        <span className="st st-green">적용</span>
                      ) : k === 'difficulty' && a.weightStatus === 'CANDIDATE' ? (
                        <span className="st st-warn">후보 · 운영자 확인 전 미적용</span>
                      ) : (
                        <span className="text-muted">해당 없음</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[13px] text-muted">가중치는 운영자만 설정하며, 기록을 제출한 시점의 단가·가중치로 고정됩니다.</p>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="panel" style={{ position: 'sticky', top: 16 }}>
            <p className="text-[14px] text-muted">1회 참여 시 예상 사회적 가치</p>
            <p className="mt-1 text-[32px] font-bold">
              {won(value)}
              <small className="ml-1 text-base font-normal">원</small>
            </p>
            <p className="calc-formula">
              {a.hoursPerSession}시간 × {won(rateOf(a.category))}원 × {a.weight.toFixed(1)}
            </p>
            <div className="mt-5">{cta}</div>
            {a.applied && <p className="mt-3 text-[13px] text-green">✓ 신청 완료 · 활동 후 「활동 기록 제출」에서 기록을 남겨 주세요.</p>}
            <button
              className="button secondary mt-3 w-full"
              onClick={() => notify(saved.toggle(a.id) ? '관심 활동에 저장했습니다.' : '관심 활동에서 삭제했습니다.')}
            >
              <Icon name="bookmark" />
              {saved.has(a.id) ? '관심 활동 저장 해제' : '관심 활동 저장'}
            </button>
          </div>
          <Calculator key={a.id} initialHours={a.hoursPerSession} initialCategory={a.category} initialWeight={a.weight} fixed />
        </aside>
      </div>
    </SubPage>
  );
}
