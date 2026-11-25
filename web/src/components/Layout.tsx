import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Dialog } from './Dialog';
import { MENU, PORTAL_LABEL, portalOfPath, type MenuSection, type Portal } from '../lib/menu';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { useTheme } from '../lib/theme';
import { api, resetMockDb } from '../api';

/* ───────── 라이트/다크 스위치 ───────── */

function ThemeSwitch() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button type="button" className="theme-switch" role="switch" aria-checked={dark} aria-label="다크 모드" title={dark ? '라이트 모드로 전환' : '다크 모드로 전환'} onClick={toggle}>
      <span className="theme-switch-icon sun" aria-hidden="true">
        <Icon name="sun" small />
      </span>
      <span className="theme-switch-icon moon" aria-hidden="true">
        <Icon name="moon" small />
      </span>
      <span className="theme-switch-knob" aria-hidden="true" />
    </button>
  );
}

/* ───────── 포털 (Green청년 / Green기관) ─────────
 * 경로로 정해지고, 고객지원처럼 공통 화면에서는 직전 포털을 유지합니다. */

const PORTAL_KEY = 'greenstep-portal';

function usePortal(): Portal {
  const { pathname, search } = useLocation();
  const fromPath = portalOfPath(pathname, search);
  const [last, setLast] = useState<Portal>(() => {
    try {
      return sessionStorage.getItem(PORTAL_KEY) === 'ORG' ? 'ORG' : 'YOUTH';
    } catch {
      return 'YOUTH';
    }
  });
  useEffect(() => {
    if (!fromPath) return;
    setLast(fromPath);
    try {
      sessionStorage.setItem(PORTAL_KEY, fromPath);
    } catch {
      /* 무시 */
    }
  }, [fromPath]);
  return fromPath ?? last;
}

/** 로고 — 라벨 이미지 + 이름. 누르면 홈으로 (이미 홈이면 맨 위로) */
function Brand({ tagline }: { tagline?: string }) {
  const { pathname } = useLocation();
  return (
    <Link className="brand" to="/" aria-label="GreenStep 홈으로" onClick={() => pathname === '/' && window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <img className="brand-logo" src="/brand/greenstep-mark.png" alt="" aria-hidden="true" />
      <span className="brand-name">
        GreenStep{tagline && <small>{tagline}</small>}
      </span>
    </Link>
  );
}

/* ───────── 상단 유틸리티 바 ───────── */

function UtilityBar({ portal }: { portal: Portal }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();

  const doLogout = async () => {
    await logout();
    notify('로그아웃했습니다.');
    navigate('/');
  };

  return (
    <div className="utility">
      <div className="container utility-inner">
        {/* 1365자원봉사포털 · 1365기부포털처럼 두 포털을 탭으로 전환 */}
        <nav className="portal-tabs" aria-label="포털 선택">
          <Link className="portal-tab" to="/" aria-current={portal === 'YOUTH' ? 'page' : undefined}>
            {PORTAL_LABEL.YOUTH}
          </Link>
          <Link
            className="portal-tab org"
            to={session?.role === 'ORG' ? '/org' : '/org/login'}
            aria-current={portal === 'ORG' ? 'page' : undefined}
            title={session?.role === 'ORG' ? '기관 대시보드로 이동합니다' : '기관 회원 로그인'}
          >
            {PORTAL_LABEL.ORG}
          </Link>
        </nav>
        <div className="utility-actions">
          <ThemeSwitch />
          {!session && (
            <>
              <Link className="text-button login" to={portal === 'ORG' ? '/org/login' : '/login'}>로그인</Link>
              <Link className="text-button join" to={portal === 'ORG' ? '/signup?type=org' : '/signup'}>회원가입</Link>
            </>
          )}
          {session?.role === 'YOUTH' && (
            <>
              <span className="utility-user">
                <span className="role-chip">청년</span>
                {session.user?.name}님
                <span className="sep" aria-hidden="true">·</span>
                <Link className="text-button" to="/me">마이페이지</Link>
              </span>
              <button className="text-button" onClick={doLogout}>로그아웃</button>
            </>
          )}
          {session?.role === 'ORG' && (
            <>
              <span className="utility-user">
                <span className="role-chip org">기관</span>
                {session.member?.name}님
                {session.org?.verificationStatus === 'PENDING' && <span className="st st-warn">심사 대기</span>}
                <span className="sep" aria-hidden="true">·</span>
                <Link className="text-button" to="/org" title="기관 대시보드로 이동합니다">마이페이지</Link>
              </span>
              <button className="text-button" onClick={doLogout}>로그아웃</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── 헤더 + 드롭다운 메가메뉴 ─────────
 * 상단 메뉴에 마우스를 올리면 전체 하위 메뉴가 한 번에 내려오고,
 * 각 하위 메뉴 열은 해당 상단 메뉴 바로 아래에 정렬됩니다. 헤더 밖으로 나가면 닫힙니다. */

function Header({ portal }: { portal: Portal }) {
  const [open, setOpen] = useState(false);
  const [hot, setHot] = useState<MenuSection['key'] | null>(null);
  const [mobile, setMobile] = useState(false);
  const closeTimer = useRef<number>();
  const { pathname, search } = useLocation();

  useEffect(() => {
    setOpen(false);
    setHot(null);
    setMobile(false);
  }, [pathname, search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const show = (key?: MenuSection['key']) => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
    if (key) setHot(key);
  };
  const hide = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setHot(null);
    }, 120);
  };

  // 기관 로그인 페이지에서는 상단 메뉴(기관 대시보드·활동 관리 등)를 모두 숨김
  const bare = pathname === '/org/login';
  const menu = bare ? [] : MENU.filter((m) => m.portals.includes(portal));

  // 원본 시안처럼 홈에서는 '봉사활동 찾기'가 현재 메뉴
  const sectionOf = (key: MenuSection['key']) => {
    if (key === 'activities') return pathname === '/' || pathname.startsWith('/activities');
    if (key === 'resume') return pathname.startsWith('/me');
    if (key === 'orgHome') return pathname === '/org';
    if (key === 'orgActivities') return pathname.startsWith('/org/activities');
    if (key === 'orgReports') return pathname.startsWith('/org/reports');
    if (key === 'support') return pathname.startsWith('/support') || pathname.startsWith('/verify');
    return false;
  };

  return (
    <header
      className={`header${open ? ' mega-open' : ''}`}
      onMouseLeave={hide}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide();
      }}
    >
      <div className="container header-inner">
        <Brand tagline={portal === 'ORG' ? '기관의 실천을 ESG경영으로' : '청년의 실천을, 사회적 가치로'} />
        {!bare && (
        <>
        <nav className={`main-nav${mobile ? ' open' : ''}`} aria-label="주 메뉴">
          {menu.map((m) => (
            <NavLink
              key={m.key}
              to={m.to}
              className={`${sectionOf(m.key) ? 'current' : ''}${hot === m.key ? ' hot' : ''}`}
              aria-current={sectionOf(m.key) ? 'page' : undefined}
              aria-haspopup="true"
              aria-expanded={open}
              onMouseEnter={() => show(m.key)}
              onFocus={() => show(m.key)}
              end
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
        <button
          className="icon-button mobile-menu"
          aria-label={mobile ? '전체 메뉴 닫기' : '전체 메뉴 열기'}
          aria-expanded={mobile}
          onClick={() => setMobile((v) => !v)}
        >
          <Icon name="menu" />
        </button>
        </>
        )}
      </div>

      {!bare && (
      <div className={`mega no-print${open ? ' open' : ''}`} onMouseEnter={() => show()} aria-hidden={!open}>
        <div className="container mega-inner">
          {menu.map((m) => (
            <div key={m.key} className={`mega-col${hot === m.key ? ' hot' : ''}`} onMouseEnter={() => setHot(m.key)}>
              {m.items.map((i) => (
                <Link key={i.to + i.label} to={i.to} tabIndex={open ? 0 : -1}>
                  {i.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      )}
    </header>
  );
}

/* ───────── 푸터 ───────── */

function Footer({ onInfo }: { onInfo: (k: 'terms' | 'privacy') => void }) {
  const notify = useToast();
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <Brand />
          <div className="footer-links">
            <Link className="text-button" to="/support?tab=guide">서비스 소개</Link>
            <button onClick={() => onInfo('terms')}>이용약관</button>
            <button onClick={() => onInfo('privacy')}>
              <strong>개인정보처리방침</strong>
            </button>
            <Link className="text-button" to="/support">고객지원</Link>
            {api.mode === 'mock' && (
              <button
                onClick={async () => {
                  if (!confirm('데모 데이터(가입·신청·기록·보고서)를 처음 상태로 되돌릴까요?')) return;
                  await resetMockDb();
                  notify('데모 데이터를 처음 상태로 되돌렸습니다.');
                  setTimeout(() => window.location.assign('/'), 600);
                }}
              >
                데모 데이터 초기화
              </button>
            )}
          </div>
        </div>
        <div className="footer-bottom">
          <div>
            <p>팀 아이스볼 · 청년 사회공헌 및 ESG 활동 플랫폼 기획 프로젝트</p>
            <p>시연용 웹입니다. 기관·공고는 예시이며 실제 모집·인증 서비스는 제공하지 않습니다.</p>
          </div>
          <p>© GreenStep. 함께하는 시간, 남겨지는 가치.</p>
        </div>
      </div>
    </footer>
  );
}

const INFO = {
  terms: ['이용약관 안내', '실제 서비스의 이용약관은 신청·검증 절차와 운영 정책을 확정한 뒤 공개할 예정입니다.'],
  privacy: [
    '개인정보 안내',
    '데모 모드에서는 입력한 정보가 이 브라우저(localStorage)에만 저장되고 서버로 전송되지 않습니다. ESG 경영 보고서에는 봉사자 인원수만 표시하며, AI 초안 기능에는 청년 개인정보를 보내지 않습니다. 실제 서비스의 개인정보처리방침은 수집 항목·보유 기간을 확정한 뒤 공개합니다.',
  ],
} as const;

export function Layout({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<keyof typeof INFO | null>(null);
  const { pathname } = useLocation();
  const portal = usePortal();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <a className="skip" href="#main">본문 바로가기</a>
      <UtilityBar portal={portal} />
      <Header portal={portal} />
      <main id="main">{children}</main>
      <Footer onInfo={setInfo} />
      <Dialog open={info !== null} title={info ? INFO[info][0] : ''} onClose={() => setInfo(null)}>
        <p>{info ? INFO[info][1] : ''}</p>
      </Dialog>
    </>
  );
}
