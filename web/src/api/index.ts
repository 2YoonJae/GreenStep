import type { Api } from './types';
import { mockApi } from './mock';
import { httpApi } from './http';

/**
 * API 진입점. 화면은 `import { api } from '../api'` 만 사용합니다.
 *   VITE_API_MODE=mock (기본) → 브라우저 목업 (백엔드 없이 시연)
 *   VITE_API_MODE=http        → FastAPI /api/v1 (src/api/endpoints.ts)
 */
export const api: Api = import.meta.env.VITE_API_MODE === 'http' ? httpApi : mockApi;

export type { Api } from './types';
export { resetDb as resetMockDb } from './mock/db';
