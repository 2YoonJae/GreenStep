import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// VITE_API_MODE=http 일 때만 /api 를 FastAPI(:8000)로 프록시합니다.
// 기본(mock)은 브라우저 안의 목업 API가 응답하므로 백엔드 없이 동작합니다.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy:
        env.VITE_API_MODE === 'http'
          ? { '/api': { target: env.VITE_API_PROXY ?? 'http://localhost:8000', changeOrigin: true } }
          : undefined,
    },
  };
});
