import { useCallback, useState } from 'react';

/** 관심 활동 — 보는 사람 브라우저에만 저장하는 편의 기능 */
const KEY = 'greenstep-saved-v1';

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function useSaved() {
  const [ids, setIds] = useState<string[]>(read);
  const toggle = useCallback((id: string) => {
    let added = false;
    setIds((prev) => {
      added = !prev.includes(id);
      const next = added ? [...prev, id] : prev.filter((x) => x !== id);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* 저장 불가 */
      }
      return next;
    });
    return added;
  }, []);
  return { ids, has: (id: string) => ids.includes(id), toggle };
}
