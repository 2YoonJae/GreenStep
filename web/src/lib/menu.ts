import type { Role } from '../data/types';

/**
 * 메뉴 구조. 사이트를 두 포털로 나눕니다 (1365자원봉사포털 · 1365기부포털처럼 맨 위 탭으로 전환).
 *   Green청년 — 봉사활동 찾기 · 봉사 이력서 · 고객지원
 *   Green기관 — 기관 대시보드 · 활동 관리 · ESG 경영 보고서 · 고객지원
 * 고객지원은 두 포털 공통. 메뉴는 모두 노출하고, 권한이 없으면 접근 시 안내합니다.
 */
export type Portal = 'YOUTH' | 'ORG';

export const PORTAL_LABEL: Record<Portal, string> = { YOUTH: 'Green청년', ORG: 'Green기관' };

export interface MenuItem {
  label: string;
  to: string;
}
export interface MenuSection {
  key: 'activities' | 'resume' | 'orgHome' | 'orgActivities' | 'orgReports' | 'support';
  label: string;
  to: string;
  portals: Portal[];
  role?: Role;
  items: MenuItem[];
}

export const MENU: MenuSection[] = [
  /* ───── Green청년 ───── */
  {
    key: 'activities',
    label: '봉사활동 찾기',
    to: '/activities',
    portals: ['YOUTH'],
    items: [
      { label: '전체 활동', to: '/activities' },
      { label: '인기 활동', to: '/activities?sort=popular' },
      { label: '마감 임박', to: '/activities?sort=deadline&closing=7' },
      { label: '교육·멘토링', to: '/activities?category=education' },
      { label: '돌봄·보육', to: '/activities?category=care' },
      { label: '생활·환경', to: '/activities?category=environment' },
      { label: '보건·의료', to: '/activities?category=health' },
    ],
  },
  {
    key: 'resume',
    label: '봉사 이력서',
    to: '/me/resume',
    portals: ['YOUTH'],
    role: 'YOUTH',
    items: [
      { label: '이력서 발급', to: '/me/resume' },
      { label: '나의 활동 기록', to: '/me/records' },
      { label: '활동 기록 제출', to: '/me/records/new' },
    ],
  },
  /* ───── Green기관 ───── */
  {
    key: 'orgHome',
    label: '기관 대시보드',
    to: '/org',
    portals: ['ORG'],
    role: 'ORG',
    items: [{ label: '대시보드 · 기록 승인', to: '/org' }],
  },
  {
    key: 'orgActivities',
    label: '활동 관리',
    to: '/org/activities',
    portals: ['ORG'],
    role: 'ORG',
    items: [
      { label: '활동 목록', to: '/org/activities' },
      { label: '새 활동 등록', to: '/org/activities/new' },
    ],
  },
  {
    key: 'orgReports',
    label: 'ESG 경영 보고서',
    to: '/org/reports',
    portals: ['ORG'],
    role: 'ORG',
    items: [{ label: '보고서 작성 · 발행', to: '/org/reports' }],
  },
  /* ───── 공통 ───── */
  {
    key: 'support',
    label: '고객지원',
    to: '/support',
    portals: ['YOUTH', 'ORG'],
    items: [
      { label: '공지사항', to: '/support?tab=notice' },
      { label: '자주 묻는 질문', to: '/support?tab=faq' },
      { label: '이용 가이드', to: '/support?tab=guide' },
      { label: '확인번호 조회', to: '/verify' },
    ],
  },
];

/** 경로로 포털을 정함. 고객지원·확인번호 조회처럼 공통 화면이면 null (직전 포털 유지) */
export function portalOfPath(pathname: string, search: string): Portal | null {
  const type = new URLSearchParams(search).get('type');
  if (pathname.startsWith('/org')) return 'ORG';
  if ((pathname === '/login' || pathname === '/signup') && type === 'org') return 'ORG';
  // /org/login 도 '/org'로 시작하므로 ORG
  if (pathname === '/' || pathname.startsWith('/activities') || pathname.startsWith('/me') || pathname === '/login' || pathname === '/signup') return 'YOUTH';
  return null;
}
