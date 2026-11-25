import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ORG_TYPE_LABEL, type Role } from '../data/types';
import { bizNo } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { api } from '../api';
import { Icon } from './Icon';
import { errorMessage } from '../lib/useAsync';

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state" style={{ marginTop: 8 }}>
      <h3 className="text-xl font-bold">{title}</h3>
      {children}
    </div>
  );
}

/**
 * 화면 접근 제한(1원칙). 메뉴는 모두 노출하고, 권한이 없으면 여기서 안내합니다.
 * 실제 데이터 보호는 서버(목업 API 포함)가 권한을 검사해서 수행합니다.
 */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { session, ready } = useAuth();
  const { pathname, search } = useLocation();
  const next = encodeURIComponent(pathname + search);
  const label = role === 'YOUTH' ? '청년 회원' : '기관 회원';

  if (!ready) return <p className="py-16 text-center text-muted">불러오는 중…</p>;
  if (!session)
    return (
      <Notice title={`${label} 전용 화면입니다`}>
        <p>로그인 후 이용해 주세요.</p>
        <div className="flex justify-center gap-2">
          <Link className="button primary" to={`${role === 'ORG' ? '/org/login' : '/login'}?next=${next}`}>
            {role === 'ORG' ? '기관 로그인' : '로그인'}
          </Link>
          <Link className="button" to={`/signup${role === 'ORG' ? '?type=org' : ''}`}>
            회원가입
          </Link>
        </div>
      </Notice>
    );
  if (session.role !== role)
    return (
      <Notice title={`${label} 전용 화면입니다`}>
        <p>현재 {session.role === 'YOUTH' ? '청년' : '기관'} 계정으로 로그인되어 있습니다. {label} 계정으로 다시 로그인해 주세요.</p>
        <Link className="button" to={session.role === 'YOUTH' ? '/me' : '/org'}>
          {session.role === 'YOUTH' ? '마이페이지로' : '기관 대시보드로'}
        </Link>
      </Notice>
    );
  return <>{children}</>;
}

/** 기관 가입 심사가 끝난 기관만 (심사 대기 중이면 안내 + 데모 승인 버튼) */
export function RequireApprovedOrg({ children }: { children: ReactNode }) {
  const { session, setOrg } = useAuth();
  const notify = useToast();
  const org = session?.org;
  if (!org) return <RequireRole role="ORG">{children}</RequireRole>;
  if (org.verificationStatus === 'APPROVED') return <>{children}</>;

  return (
    <div className="panel" style={{ marginTop: 8 }}>
      <div className="flex items-start gap-4">
        <span className="caption-check" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
          <Icon name="shield" />
        </span>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{org.verificationStatus === 'REJECTED' ? '가입 심사가 반려되었습니다' : '운영자 심사 중입니다'}</h2>
          <p className="mt-2 text-body">
            {org.name}의 가입 신청을 확인하고 있습니다. 사업자등록번호({bizNo(org.businessNo)}) 확인이 끝나면 활동 등록·기록 승인·ESG 경영 보고서 기능을 이용할 수 있습니다.
          </p>
          <dl className="detail-list" style={{ maxWidth: 520 }}>
            <div><dt>기관 유형</dt><dd>{ORG_TYPE_LABEL[org.organizationType]}</dd></div>
            <div><dt>소재지</dt><dd>{org.address}</dd></div>
            <div><dt>공식 이메일</dt><dd>{org.contactEmail}</dd></div>
            <div><dt>심사 상태</dt><dd>{org.verificationStatus === 'REJECTED' ? <span className="st st-danger">반려</span> : <span className="st st-warn">심사 대기</span>}</dd></div>
          </dl>
          {api.org.demoApproveReview && (
            <div className="alert info">
              <Icon name="info" small />
              <div className="flex-1">
                <p>운영자 화면은 아직 없습니다. 시연을 위해 아래 버튼으로 심사 승인을 흉내 낼 수 있습니다.</p>
                <button
                  className="button primary small mt-3"
                  onClick={async () => {
                    try {
                      const o = await api.org.demoApproveReview!();
                      setOrg(o);
                      notify('심사가 승인되었습니다. 이제 활동을 등록할 수 있습니다.');
                    } catch (e) {
                      notify(errorMessage(e));
                    }
                  }}
                >
                  [데모] 심사 승인 처리
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
