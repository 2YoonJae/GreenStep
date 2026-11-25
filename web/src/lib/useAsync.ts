import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../data/types';

/** API 호출 상태 관리. deps 가 바뀌면 다시 불러옵니다. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const load = useCallback(() => {
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    fn()
      .then((v) => {
        if (my === seq.current) setData(v);
      })
      .catch((e) => {
        if (my === seq.current) setError(errorMessage(e));
      })
      .finally(() => {
        if (my === seq.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return '알 수 없는 오류가 발생했습니다.';
}
