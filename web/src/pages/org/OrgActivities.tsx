import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { Activity, ActivityStatus } from '../../data/types';
import { SubPage } from '../../components/SubPage';
import { RequireApprovedOrg } from '../../components/Guards';
import { Icon } from '../../components/Icon';
import { ActivityStatusBadge, Empty, ErrorBox, Loading, WeightBadge } from '../../components/ui';
import { errorMessage, useAsync } from '../../lib/useAsync';
import { useToast } from '../../lib/toast';
import { CATEGORY_META } from '../../lib/sroi';
import { dateDot, dday, period } from '../../lib/format';

type Tab = 'ALL' | ActivityStatus;

function Body() {
  const notify = useToast();
  const { data, error, loading, reload } = useAsync(() => api.org.activities(), []);
  const [tab, setTab] = useState<Tab>('ALL');

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      notify(msg);
      reload();
    } catch (e) {
      notify(errorMessage(e));
    }
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const all = data!;
  const rows = all.filter((a) => tab === 'ALL' || a.status === tab);
  const count = (t: Tab) => (t === 'ALL' ? all.length : all.filter((a) => a.status === t).length);

  const actions = (a: Activity) => (
    <div className="flex flex-wrap justify-end gap-2">
      <Link className="button small" to={`/activities/${a.id}`}>보기</Link>
      {(a.status === 'DRAFT' || a.status === 'RECRUITING') && <Link className="button small" to={`/org/activities/${a.id}/edit`}>수정</Link>}
      {a.status === 'DRAFT' && (
        <>
          <button className="button small primary" onClick={() => act(() => api.org.setActivityStatus(a.id, 'RECRUITING'), '활동을 게시했습니다.')}>게시</button>
          <button className="button small danger" onClick={() => confirm('임시저장한 활동을 삭제할까요?') && act(() => api.org.deleteActivity(a.id), '삭제했습니다.')}>삭제</button>
        </>
      )}
      {a.status === 'RECRUITING' && (
        <>
          {a.applicantCount === 0 && <button className="button small" onClick={() => act(() => api.org.setActivityStatus(a.id, 'DRAFT'), '임시저장으로 내렸습니다.')}>게시 취소</button>}
          <button className="button small" onClick={() => confirm('모집을 마감할까요?') && act(() => api.org.setActivityStatus(a.id, 'CLOSED'), '모집을 마감했습니다.')}>마감</button>
          <button className="button small danger" onClick={() => confirm('공고를 취소할까요? 신청자에게는 취소된 활동으로 표시됩니다.') && act(() => api.org.setActivityStatus(a.id, 'CANCELLED'), '공고를 취소했습니다.')}>공고 취소</button>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="filter-row">
        <div className="filters">
          {(
            [
              ['ALL', '전체'],
              ['RECRUITING', '모집 중'],
              ['DRAFT', '임시저장'],
              ['CLOSED', '마감'],
              ['CANCELLED', '취소'],
            ] as [Tab, string][]
          ).map(([t, l]) => (
            <button key={t} className="filter" aria-pressed={tab === t} onClick={() => setTab(t)}>
              {l} <span className="text-muted">{count(t)}</span>
            </button>
          ))}
        </div>
        <Link className="button primary small" to="/org/activities/new">
          <Icon name="plus" small />
          새 활동 등록
        </Link>
      </div>
      {rows.length === 0 ? (
        <Empty title="등록한 활동이 없습니다">
          <p>새 활동을 등록하면 청년들이 검색하고 신청할 수 있습니다.</p>
          <Link className="button primary" to="/org/activities/new">새 활동 등록</Link>
        </Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>상태</th>
              <th>활동</th>
              <th>기간 · 마감</th>
              <th className="num">신청</th>
              <th>가중치</th>
              <th className="num">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><ActivityStatusBadge status={a.status} /></td>
                <td>
                  <p className="font-bold">{a.title}</p>
                  <p className="text-[13px] text-muted">{CATEGORY_META[a.category].label} · {a.regionName} · 회당 {a.hoursPerSession}시간</p>
                </td>
                <td className="whitespace-nowrap text-[14px]">
                  {period(a.activityStartDate, a.activityEndDate)}
                  <p className="text-muted">마감 {dateDot(a.recruitEndDate)} {a.status === 'RECRUITING' && `(${dday(a.recruitEndDate)})`}</p>
                </td>
                <td className="num">{a.applicantCount} / {a.capacity}</td>
                <td><WeightBadge status={a.weightStatus} weight={a.weight} /></td>
                <td className="num">{actions(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="activity-note">
        <Icon name="info" small />
        임시저장 공고는 작성 기관에게만 보입니다. 직무 난이도 가중치는 등록 내용으로 자동 분류한 '후보'이며, 운영자 확인 전까지 1.0으로 계산됩니다.
      </p>
    </>
  );
}

export default function OrgActivities() {
  return (
    <SubPage section="orgActivities" title="활동 관리" desc="모집 공고를 작성·수정하고 게시 상태를 관리하세요.">
      <RequireApprovedOrg>
        <Body />
      </RequireApprovedOrg>
    </SubPage>
  );
}
