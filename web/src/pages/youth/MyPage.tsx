import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { SubPage } from '../../components/SubPage';
import { RequireRole } from '../../components/Guards';
import { Dialog } from '../../components/Dialog';
import { Empty, ErrorBox, Kpis, Loading, RecordStatus } from '../../components/ui';
import { errorMessage, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { sumHours, sumValue } from '../../lib/aggregate';
import { dateDot, daysUntil, num, period, won } from '../../lib/format';
import { TARGET_FIELDS } from '../../data/types';

function Body() {
  const { session, setUser } = useAuth();
  const notify = useToast();
  const user = session!.user!;
  const apps = useAsync(() => api.applications.mine(), []);
  const recs = useAsync(() => api.participations.mine(), []);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: user.name, school: user.school, targetField: user.targetField });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      // users.name + user_profiles
      setUser(await api.me.update({ name: form.name, profile: { school: form.school, targetField: form.targetField, marketingConsent: user.marketingConsent } }));
      notify('프로필을 저장했습니다.');
      setEdit(false);
    } catch (err) {
      notify(errorMessage(err));
    }
  };
  const cancel = async (activityId: string) => {
    if (!confirm('이 활동 신청을 취소할까요?')) return;
    try {
      await api.applications.cancel(activityId);
      notify('신청을 취소했습니다.');
      apps.reload();
    } catch (err) {
      notify(errorMessage(err));
    }
  };

  const list = recs.data ?? [];
  return (
    <div className="flex flex-col gap-8">
      <div className="panel flex items-center gap-6">
        <span className="caption-check" style={{ width: 56, height: 56 }}>
          <span className="text-xl font-bold">{user.name.slice(0, 1)}</span>
        </span>
        <div className="flex-1">
          <p className="text-xl font-bold">{user.name}님</p>
          <p className="text-[15px] text-muted">
            {user.school || '학교 미입력'} · 희망 분야 {user.targetField} · {user.email}
          </p>
        </div>
        <button className="button small" onClick={() => setEdit(true)}>프로필 수정</button>
        <Link className="button primary small" to="/me/resume">봉사 이력서 발급</Link>
      </div>

      {recs.loading ? (
        <Loading />
      ) : recs.error ? (
        <ErrorBox message={recs.error} onRetry={recs.reload} />
      ) : (
        <Kpis
          items={[
            { label: '누적 사회적 가치', value: won(sumValue(list)), unit: '원', note: '기관 승인 기록 기준' },
            { label: '인증 활동 시간', value: num(sumHours(list)), unit: '시간' },
            { label: '승인 대기', value: num(list.filter((p) => p.status === 'PENDING').length), unit: '건' },
            { label: '검증 대기 (1365)', value: num(list.filter((p) => p.status === 'EXTERNAL_PENDING').length), unit: '건', note: '검증 전 집계 미반영' },
          ]}
        />
      )}

      <section className="panel">
        <div className="panel-title">
          <h2>신청 내역</h2>
          <Link className="text-[14px] text-hover hover:underline" to="/activities">활동 더 찾기 →</Link>
        </div>
        {apps.loading && <Loading />}
        {apps.error && <ErrorBox message={apps.error} />}
        {apps.data && apps.data.length === 0 && <Empty title="신청한 활동이 없습니다"><p>관심 있는 봉사활동을 찾아 신청해 보세요.</p></Empty>}
        {apps.data && apps.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>활동</th>
                <th>기관</th>
                <th>일정</th>
                <th>상태</th>
                <th className="num">관리</th>
              </tr>
            </thead>
            <tbody>
              {apps.data.map((ap) => {
                const a = ap.activity;
                const started = daysUntil(a.activityStartDate) <= 0;
                const ended = daysUntil(a.activityEndDate) < 0;
                return (
                  <tr key={ap.id}>
                    <td><Link className="font-bold hover:text-hover hover:underline" to={`/activities/${a.id}`}>{a.title}</Link></td>
                    <td>{a.orgName}</td>
                    <td>{period(a.activityStartDate, a.activityEndDate)}</td>
                    <td>{ended ? <span className="st st-gray">활동 종료</span> : started ? <span className="st st-green">활동 중</span> : <span className="st st-blue">시작 D-{daysUntil(a.activityStartDate)}</span>}</td>
                    <td className="num">
                      <div className="flex justify-end gap-2">
                        {started && <Link className="button small primary" to={`/me/records/new?activity=${a.id}`}>기록 제출</Link>}
                        {!started && <button className="button small" onClick={() => cancel(a.id)}>신청 취소</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>최근 활동 기록</h2>
          <Link className="text-[14px] text-hover hover:underline" to="/me/records">전체 기록 보기 →</Link>
        </div>
        {list.length === 0 ? (
          <Empty title="제출한 활동 기록이 없습니다" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>활동일</th>
                <th>활동</th>
                <th className="num">시간</th>
                <th className="num">사회적 가치</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 5).map((p) => (
                <tr key={p.id}>
                  <td>{dateDot(p.date)}</td>
                  <td>{p.activityTitle}<span className="ml-2 text-[13px] text-muted">{p.orgName}</span></td>
                  <td className="num">{p.hours}h</td>
                  <td className="num">{won(p.valueKrw)}원</td>
                  <td><RecordStatus status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Dialog
        open={edit}
        title="프로필 수정"
        onClose={() => setEdit(false)}
        actions={
          <>
            <button className="button" onClick={() => setEdit(false)}>취소</button>
            <button className="button primary" form="profile-form">저장</button>
          </>
        }
      >
        <form id="profile-form" className="flex flex-col gap-4" onSubmit={save}>
          <div className="field">
            <label htmlFor="p-name">이름</label>
            <input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="p-school">학교 · 전공</label>
            <input id="p-school" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="p-target">희망 분야</label>
            <select id="p-target" value={form.targetField} onChange={(e) => setForm({ ...form, targetField: e.target.value })}>
              {TARGET_FIELDS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

export default function MyPage() {
  return (
    <SubPage section="resume" title="마이페이지" desc="신청 내역과 활동 기록, 누적 사회적 가치를 확인하세요.">
      <RequireRole role="YOUTH">
        <Body />
      </RequireRole>
    </SubPage>
  );
}
