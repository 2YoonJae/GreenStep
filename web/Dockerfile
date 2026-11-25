# 빌드 컨텍스트: src/ (docker-compose.yml 위치). web/ 와 nginx/ 를 함께 사용합니다.

# 1) 프론트엔드 빌드
FROM node:22-alpine AS build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
ARG VITE_API_MODE=mock
ENV VITE_API_MODE=$VITE_API_MODE
RUN npm run build

# 2) nginx 로 정적 파일 서빙 (+ 백엔드 생기면 /api/ 프록시)
FROM nginx:1.27-alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
