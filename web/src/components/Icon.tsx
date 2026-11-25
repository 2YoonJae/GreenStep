/** 원본 시안의 SVG 아이콘 스프라이트 */
export function IconSprite() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }}>
      <defs>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></symbol>
        <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h16m-6-6 6 6-6 6" /></symbol>
        <symbol id="i-pin" viewBox="0 0 24 24"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></symbol>
        <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 11h16m-11 4h2m3 0h2" /></symbol>
        <symbol id="i-bookmark" viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4Z" /></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></symbol>
        <symbol id="i-shield" viewBox="0 0 24 24"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></symbol>
        <symbol id="i-file" viewBox="0 0 24 24"><path d="M14 3H5v18h14V8Z" /><path d="M14 3v5h5M8 12h8m-8 4h6" /></symbol>
        <symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 3v18h17M8 16v-4m5 4V7m5 9v-6" /></symbol>
        <symbol id="i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6" /></symbol>
        <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></symbol>
        <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.2" /></symbol>
        <symbol id="i-settings" viewBox="0 0 24 24"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="2" fill="currentColor" stroke="none" /></symbol>
        <symbol id="i-building" viewBox="0 0 24 24"><path d="M4 21V5l8-2v18M12 21h8V9l-8-2" /><path d="M8 8v.01M8 12v.01M8 16v.01M16 12v.01M16 16v.01" /></symbol>
        <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></symbol>
        <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14" /></symbol>
        <symbol id="i-print" viewBox="0 0 24 24"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3" /><rect x="7" y="14" width="10" height="7" /></symbol>
        <symbol id="i-briefcase" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V4h6v3M3 12h18" /></symbol>
        <symbol id="i-sparkle" viewBox="0 0 24 24"><path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6" /></symbol>
        <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" /></symbol>
        <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></symbol>
        <symbol id="i-prev" viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></symbol>
        <symbol id="i-next" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></symbol>
        <symbol id="i-pause" viewBox="0 0 24 24"><path d="M9 5v14M15 5v14" /></symbol>
        <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5Z" /></symbol>
      </defs>
    </svg>
  );
}

export type IconName =
  | 'search' | 'arrow' | 'pin' | 'calendar' | 'bookmark' | 'check' | 'shield' | 'file' | 'chart' | 'close' | 'menu' | 'info'
  | 'settings' | 'building' | 'user' | 'plus' | 'download' | 'print' | 'briefcase' | 'sparkle'
  | 'moon' | 'sun' | 'prev' | 'next' | 'pause' | 'play';

export function Icon({ name, small, className = '' }: { name: IconName; small?: boolean; className?: string }) {
  return (
    <svg className={`icon${small ? ' small' : ''} ${className}`} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
