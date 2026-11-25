import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { errorMessage } from '../lib/useAsync';
import { Icon } from '../components/Icon';
import { ORG_TYPE_LABEL, TARGET_FIELDS, type OrgType } from '../data/types';

const pwRule = (pw: string) => pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
const EMAIL = /^\S+@\S+\.\S+$/;

function Field({ id, label, req, help, children, wide }: { id: string; label: string; req?: boolean; help?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`field${wide ? ' wide' : ''}`}>
      <label htmlFor={id}>
        {label}
        {req && <span className="req">*</span>}
      </label>
      {children}
      {help && <p className="help">{help}</p>}
    </div>
  );
}

/* 청년 가입 → users(이메일·비밀번호·이름) + user_profiles(학교·희망 분야·마케팅 동의) */
function YouthForm() {
  const { signupYouth } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '', school: '', targetField: '복지관', agree: false, marketing: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!f.name.trim()) return setError('이름을 입력해 주세요.');
    if (!EMAIL.test(f.email)) return setError('이메일 형식을 확인해 주세요.');
    if (!pwRule(f.password)) return setError('비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.');
    if (f.password !== f.confirm) return setError('비밀번호 확인이 일치하지 않습니다.');
    if (!f.agree) return setError('이용약관 및 개인정보 수집·이용에 동의해 주세요.');
    setBusy(true);
    try {
      await signupYouth({
        email: f.email,
        password: f.password,
        name: f.name,
        profile: { school: f.school, targetField: f.targetField, marketingConsent: f.marketing },
      });
      notify('가입을 환영합니다. 관심 있는 활동을 찾아보세요.');
      navigate('/me');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit} noValidate>
      <h2 className="wide text-lg font-bold">계정 정보</h2>
      <Field id="s-name" label="이름" req>
        <input id="s-name" value={f.name} onChange={set('name')} autoComplete="name" maxLength={100} />
      </Field>
      <Field id="s-email" label="이메일 (로그인 ID)" req>
        <input id="s-email" type="email" value={f.email} onChange={set('email')} autoComplete="email" maxLength={255} />
      </Field>
      <Field id="s-pw" label="비밀번호" req help="영문·숫자 포함 8자 이상">
        <input id="s-pw" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" />
      </Field>
      <Field id="s-pw2" label="비밀번호 확인" req>
        <input id="s-pw2" type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" />
      </Field>

      <h2 className="wide mt-4 text-lg font-bold">
        프로필 <span className="text-[14px] font-normal text-muted">선택 입력 · 봉사 이력서에 표시됩니다</span>
      </h2>
      <Field id="s-school" label="학교 · 전공">
        <input id="s-school" value={f.school} onChange={set('school')} placeholder="예) 한국대학교 사회복지학과" maxLength={200} />
      </Field>
      <Field id="s-target" label="희망 분야">
        <select id="s-target" value={f.targetField} onChange={set('targetField')}>
          {TARGET_FIELDS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </Field>
      <div className="wide flex flex-col gap-3 rounded-lg bg-surface p-5">
        <label className="check">
          <input type="checkbox" checked={f.agree} onChange={set('agree')} />
          <span><strong>[필수]</strong> 이용약관 및 개인정보 수집·이용(이메일·이름·학교·희망 분야)에 동의합니다.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={f.marketing} onChange={set('marketing')} />
          [선택] 새 활동 소식을 이메일로 받겠습니다.
        </label>
      </div>
      {error && <p className="form-error wide" role="alert">{error}</p>}
      <button className="button primary wide" style={{ minHeight: 56 }} disabled={busy}>
        {busy ? '가입 중…' : '청년 회원가입'}
      </button>
    </form>
  );
}

/*
 * 기관 가입 →
 *   organizations         : 기관명 · 기관 유형 · 사업자등록번호 · 주소 · 공식 이메일 (심사 상태는 서버가 PENDING 으로)
 *   organization_profiles : 기관 소개
 *   users + org_members   : 담당자 이름 · 이메일 · 비밀번호 (role=OWNER)
 */
function OrgForm() {
  const { signupOrg } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  const [f, setF] = useState({
    name: '', organizationType: 'WELFARE_CENTER' as OrgType, businessNo: '', address: '', contactEmail: '', intro: '',
    managerName: '', managerEmail: '', password: '', confirm: '', agree: false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!f.name.trim()) return setError('기관명을 입력해 주세요.');
    if (f.businessNo.replace(/\D/g, '').length !== 10) return setError('사업자등록번호 10자리를 입력해 주세요.');
    if (!EMAIL.test(f.contactEmail)) return setError('기관 공식 이메일 형식을 확인해 주세요.');
    if (!f.address.trim()) return setError('기관 주소를 입력해 주세요.');
    if (!f.managerName.trim()) return setError('담당자 이름을 입력해 주세요.');
    if (!EMAIL.test(f.managerEmail)) return setError('담당자 이메일 형식을 확인해 주세요.');
    if (!pwRule(f.password)) return setError('비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.');
    if (f.password !== f.confirm) return setError('비밀번호 확인이 일치하지 않습니다.');
    if (!f.agree) return setError('기관 이용약관에 동의해 주세요.');
    setBusy(true);
    try {
      await signupOrg({
        organization: { name: f.name, organizationType: f.organizationType, address: f.address, contactEmail: f.contactEmail, businessNo: f.businessNo },
        profile: { intro: f.intro },
        manager: { name: f.managerName, email: f.managerEmail, password: f.password },
      });
      notify('가입 신청이 접수되었습니다. 운영자 심사 후 이용할 수 있습니다.');
      navigate('/org');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit} noValidate>
      <h2 className="wide text-lg font-bold">기관 정보</h2>
      <Field id="o-name" label="기관명" req>
        <input id="o-name" value={f.name} onChange={set('name')} maxLength={200} />
      </Field>
      <Field id="o-type" label="기관 유형" req>
        <select id="o-type" value={f.organizationType} onChange={set('organizationType')}>
          {(Object.keys(ORG_TYPE_LABEL) as OrgType[]).map((t) => (
            <option key={t} value={t}>{ORG_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </Field>
      <Field id="o-biz" label="사업자등록번호" req help="가입 심사와 기관 식별에 사용합니다">
        <input id="o-biz" value={f.businessNo} onChange={set('businessNo')} placeholder="000-00-00000" inputMode="numeric" maxLength={12} />
      </Field>
      <Field id="o-contact" label="기관 공식 이메일" req help="기관 대표 연락처 (로그인 ID와 달라도 됩니다)">
        <input id="o-contact" type="email" value={f.contactEmail} onChange={set('contactEmail')} maxLength={255} />
      </Field>
      <Field id="o-addr" label="기관 주소" req wide>
        <input id="o-addr" value={f.address} onChange={set('address')} placeholder="예) 서울 마포구 배움길 34" maxLength={255} />
      </Field>
      <Field id="o-intro" label="기관 소개" wide help="선택 입력 · ESG 경영 보고서의 기관 소개 초안에 사용됩니다">
        <textarea id="o-intro" value={f.intro} onChange={set('intro')} rows={3} />
      </Field>

      <h2 className="wide mt-4 text-lg font-bold">담당자 계정</h2>
      <Field id="o-mgr" label="담당자 이름" req>
        <input id="o-mgr" value={f.managerName} onChange={set('managerName')} maxLength={100} />
      </Field>
      <Field id="o-email" label="담당자 이메일 (로그인 ID)" req>
        <input id="o-email" type="email" value={f.managerEmail} onChange={set('managerEmail')} autoComplete="email" maxLength={255} />
      </Field>
      <Field id="o-pw" label="비밀번호" req help="영문·숫자 포함 8자 이상">
        <input id="o-pw" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" />
      </Field>
      <Field id="o-pw2" label="비밀번호 확인" req>
        <input id="o-pw2" type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" />
      </Field>
      <div className="wide rounded-lg bg-surface p-5">
        <label className="check">
          <input type="checkbox" checked={f.agree} onChange={set('agree')} />
          <span><strong>[필수]</strong> 기관 이용약관에 동의하며, 가입 후 운영자 심사(사업자등록번호 확인)를 거치는 것에 동의합니다.</span>
        </label>
      </div>
      {error && <p className="form-error wide" role="alert">{error}</p>}
      <button className="button primary wide" style={{ minHeight: 56 }} disabled={busy}>
        {busy ? '신청 중…' : '기관 가입 신청'}
      </button>
    </form>
  );
}

export default function Signup() {
  const [params, setParams] = useSearchParams();
  const type = params.get('type') === 'org' ? 'org' : 'youth';
  return (
    <div className="bg-hero py-16">
      <div className="container">
        <div className="mx-auto max-w-[760px] rounded-lg border border-line bg-white p-10">
          <h1 className="text-[28px] font-bold">{type === 'org' ? '기관 회원가입' : '회원가입'}</h1>
          <p className="mt-1 text-muted">
            {type === 'org' ? '가입 신청 후 운영자 심사가 끝나면 활동 등록·기록 승인·ESG 경영 보고서를 이용할 수 있습니다.' : '활동을 신청하고 승인된 기록으로 봉사 이력서를 발급받으세요.'}
          </p>
          <div className="seg mt-6 mb-8 w-full" role="group" aria-label="회원 유형">
            <button type="button" className="flex-1" aria-pressed={type === 'youth'} onClick={() => setParams({}, { replace: true })}>
              <span className="inline-flex items-center gap-2"><Icon name="user" small />개인(청년)</span>
            </button>
            <button type="button" className="flex-1" aria-pressed={type === 'org'} onClick={() => setParams({ type: 'org' }, { replace: true })}>
              <span className="inline-flex items-center gap-2"><Icon name="building" small />기관</span>
            </button>
          </div>
          {type === 'org' ? <OrgForm /> : <YouthForm />}
          <p className="mt-6 text-center text-[15px] text-muted">
            이미 회원이신가요?{' '}
            <Link className="font-bold text-hover hover:underline" to={type === 'org' ? '/org/login' : '/login'}>
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
