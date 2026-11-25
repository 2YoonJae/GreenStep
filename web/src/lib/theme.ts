import { useCallback, useEffect, useState } from 'react';

/**
 * 라이트/다크 모드. <html data-theme="light|dark"> 로 CSS 토큰을 전환합니다.
 * 처음 방문: 시스템 설정을 따름 → 스위치를 누르면 그 선택을 브라우저에 기억.
 * (첫 화면 깜빡임 방지용 초기값은 index.html 의 인라인 스크립트가 먼저 설정)
 */
export type Theme = 'light' | 'dark';
const KEY = 'greenstep-theme';

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

const system = (): Theme => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#14171b' : '#256ef4');
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || stored() || system());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 사용자가 직접 고르기 전에는 시스템 설정 변경을 따라감
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => {
      if (!stored()) setTheme(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
    };
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* 저장 불가 — 이번 방문에만 적용 */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
