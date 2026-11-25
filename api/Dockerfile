# GreenStep 1365 봉사 공고 수집 워커
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY greenstep_collector.py .

# 인증키 등 설정은 docker-compose.yml 의 env_file(./api/.env)로 주입 — 이미지에는 넣지 않음
CMD ["python", "greenstep_collector.py"]
