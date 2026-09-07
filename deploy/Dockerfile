# Single image: the built frontend served by the FastAPI backend.
#   docker build -f deploy/Dockerfile -t chatprfaq .
#   docker run -p 8000:8000 -e ANTHROPIC_API_KEY=... -e DATABASE_URL=... chatprfaq

FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv
COPY backend/pyproject.toml ./backend/pyproject.toml
COPY backend/app ./backend/app
COPY backend/scripts ./backend/scripts
RUN pip install --no-cache-dir "./backend[postgres]"
COPY --from=web /web/dist ./web/dist
WORKDIR /srv/backend
ENV STATIC_DIR=../web/dist \
    DATABASE_URL=sqlite+aiosqlite:////data/chatprfaq.db \
    ALLOWED_ORIGINS='["*"]'
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health').status==200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
