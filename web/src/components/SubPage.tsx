import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MENU, type MenuSection } from '../lib/menu';

/** 하위 화면 공통 틀 — 제목 띠 + 섹션 탭 + 본문 */
export function SubPage({ section, title, desc, children, actions, wide }: { section: MenuSection['key']; title: string; desc?: string; children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  const sec = MENU.find((m) => m.key === section)!;
  const { pathname, search } = useLocation();
  const here = pathname + search;
  // 쿼리까지 일치하는 탭 우선, 없으면 경로 일치
  const exact = sec.items.find((i) => i.to === here);
  const activeTo = exact?.to ?? sec.items.find((i) => i.to === pathname)?.to;

  return (
    <>
      <div className="page-head">
        <div className="container flex items-end justify-between gap-6">
          <div>
            <p className="crumbs">
              <span>홈</span>
              <span>{sec.label}</span>
              <span>{title}</span>
            </p>
            <h1>{title}</h1>
            {desc && <p>{desc}</p>}
          </div>
          {actions && <div className="flex gap-2 no-print">{actions}</div>}
        </div>
      </div>
      <div className={`container print-root ${wide ? '' : ''}`} style={{ paddingTop: 0, paddingBottom: 64 }}>
        <nav className="subnav no-print" aria-label={`${sec.label} 메뉴`}>
          {sec.items.map((i) => (
            <NavLink key={i.to + i.label} to={i.to} className={() => (i.to === activeTo ? 'active' : '')} end>
              {i.label}
            </NavLink>
          ))}
        </nav>
        {children}
      </div>
    </>
  );
}
