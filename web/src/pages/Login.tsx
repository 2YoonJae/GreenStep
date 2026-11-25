import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { errorMessage } from '../lib/useAsync';
import { Icon } from '../components/Icon';
import { api } from '../api';

/**
 * 로그인 화면. 청년(/login)과 기관(/org/login)을 서로 다른 페이지로 나눕니다.
 * 기관 로그인 페이지에서는 헤더의 상단 메뉴를 숨깁니다 (Layout 참고).
 */
export default function Login({ type }: { type: 'youth' | 'org' }) {
  const [params] = useSearchParams();
  const next = params.get('next');
  const { loginYouth, loginOrg } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 예전 주소(/login?type=org)로 들어오면 기관 로그인 페이지로 보냄
  if (type === 'youth' && params.get('type') === 'org') {
    return <Navigate to={`/org/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} replace />;
  }

  const org = type === 'org';
  const demoEmail = org ? 'org@demo.kr' : 'youth@demo.kr';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('이메일 형식을 확인해 주세요.');
    if (!password) return setError('비밀번호를 입력해 주세요.');
    setBusy(true);
    try {
      const s = org ? await loginOrg(email, password) : await loginYouth(email, password);
      notify(s.role === 'ORG' ? `${s.org?.name} 담당자로 로그인했습니다.` : `${s.user?.name}님, 환영합니다.`);
      navigate(next && next.startsWith('/') ? next : s.role === 'ORG' ? '/org' : '/me', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-hero py-16">
      <div className="container">
        <div className="mx-auto max-w-[520px] rounded-lg border border-line bg-white p-10">
          <p className="inline-flex items-center gap-2 text-[14px] font-bold text-hover">
            <Icon name={org ? 'building' : 'user'} small />
            {org ? 'Green기관 · 기관 회원' : 'Green청년 · 개인 회원'}
          </p>
          <h1 className="mt-2 text-[28px] font-bold">{org ? '기관 로그인' : '청년 로그인'}</h1>
          <p className="mt-1 text-muted">
            {org ? '기관 담당자 계정으로 활동 등록·기록 승인·ESG 경영 보고서를 이용합니다.' : '청년 회원으로 활동을 신청하고 봉사 이력서를 발급받으세요.'}
          </p>

          <form className="mt-6 flex flex-col gap-5" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="l-email">{org ? '담당자 이메일' : '이메일'}</label>
              <input id="l-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="l-pw">비밀번호</label>
              <input id="l-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button primary" style={{ minHeight: 56 }} disabled={busy}>
              {busy ? '확인 중…' : org ? '기관 로그인' : '로그인'}
            </button>
          </form>

          {api.mode === 'mock' && (
            <div className="alert info mt-6">
              <Icon name="info" small />
              <div className="flex-1 text-[14px]">
                <p>
                  데모 계정: <strong>{demoEmail}</strong> / <strong>demo1234</strong>
                </p>
                <button
                  type="button"
                  className="mt-2 text-hover underline"
                  onClick={() => {
                    setEmail(demoEmail);
                    setPassword('demo1234');
                  }}
                >
                  데모 계정 입력하기
                </button>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-[15px] text-muted">
            아직 회원이 아니신가요?{' '}
            <Link className="font-bold text-hover hover:underline" to={org ? '/signup?type=org' : '/signup'}>
              {org ? '기관 회원가입' : '회원가입'}
            </Link>
          </p>
          <p className="mt-2 text-center text-[14px] text-muted">
            {org ? '청년 회원이신가요? ' : '기관 담당자이신가요? '}
            <Link className="text-hover hover:underline" to={org ? '/login' : '/org/login'}>
              {org ? 'Green청년 로그인 →' : 'Green기관 로그인 →'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
