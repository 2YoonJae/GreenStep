import { ApiError } from '../../data/types';
import { EP } from '../endpoints';

const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

/** access 토큰은 메모리에만 보관 (XSS 노출 최소화). refresh 는 서버가 httpOnly 쿠키로 관리 */
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(query?: Query): string {
  if (!query) return '';
  const p = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || v === false) return;
    p.set(k, v === true ? '1' : String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshing ??= fetch(BASE + EP.auth.refresh, { method: 'POST', credentials: 'include' })
    .then(async (r) => {
      if (!r.ok) return false;
      const s = await r.json();
      setAccessToken(s.accessToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown; form?: FormData; retry?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(BASE + path + qs(opts.query), { method, headers, body, credentials: 'include' });

  // access 만료 → refresh 1회 시도 후 재요청
  if (res.status === 401 && opts.retry !== false && path !== EP.auth.refresh) {
    if (await tryRefresh()) return request<T>(method, path, { ...opts, retry: false });
  }
  if (!res.ok) {
    let message = `요청을 처리하지 못했습니다. (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.detail === 'string') message = data.detail;
    } catch {
      /* 본문 없음 */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  del: <T>(path: string) => request<T>('DELETE', path),
  form: <T>(path: string, form: FormData) => request<T>('POST', path, { form }),
};
