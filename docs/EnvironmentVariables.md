# Environment Variables

Every variable used by the project, with purpose, example, and required/optional status.

Copy examples before editing:

```bat
REM Windows
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

```bash
# Linux / macOS
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**Never commit `.env` files.** Only `.env.example` belongs in git.

---

## Backend — `backend/.env`

### Application server

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `APP_HOST` | Interface the API binds to | `0.0.0.0` | Optional (default `0.0.0.0`) |
| `APP_PORT` | Port the API listens on | `8000` | Optional (default `8000`) |

### Verification Engine V1

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `TRUTHSCAN_API_KEY` | API key for Engine V1 | `your-engine-v1-api-key` | **Yes** when using V1 |
| `TRUTHSCAN_BASE_URL` | Base URL for Engine V1 API | `https://api.example-v1.com` | **Yes** when using V1 |
| `TRUTHSCAN_TIMEOUT` | HTTP timeout (seconds) | `60` | Optional (default `60`) |

### Verification Engine V2

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `PAPERWORK_API_KEY` | API key for Engine V2 | `your-engine-v2-api-key` | **Yes** when using V2 |
| `PAPERWORK_BASE_URL` | Base URL for Engine V2 API | `https://api.example-v2.com` | **Yes** when using V2 |
| `PAPERWORK_TIMEOUT` | HTTP timeout (seconds) | `300` | Optional (default `300`) |

### Azure OpenAI (optional)

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | `…` | Optional |
| `AZURE_OPENAI_ENDPOINT` | Resource endpoint | `https://your-resource.openai.azure.com/` | Optional |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment / model name | `gpt-4o` | Optional |

### Azure Document Intelligence (optional PDF Structure)

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Document Intelligence endpoint | `https://your-resource.cognitiveservices.azure.com/` | Optional |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | Document Intelligence API key | `…` | Optional |
| `AZURE_DOCUMENT_INTELLIGENCE_MODEL` | Model id | `prebuilt-layout` | Optional (default `prebuilt-layout`; `prebuilt-document` is retired in API 2024-11-30) |
| `AZURE_DOCUMENT_INTELLIGENCE_TIMEOUT` | HTTP timeout (seconds) | `120` | Optional (default `120`) |

> Naming note: `TRUTHSCAN_*` and `PAPERWORK_*` are internal settings keys for Engine V1 / V2 adapters. Product docs and the UI refer only to **Verification Engine V1** and **Verification Engine V2**.

---

## Frontend — `frontend/.env`

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `VITE_API_BASE_URL` | Host-visible backend URL; used as Vite proxy fallback outside Docker | `http://localhost:8000` | Optional |
| `VITE_VERIFICATION_ENGINE` | Active engine id | `v1` or `v2` | **Yes** |

### Docker-only (set by Compose)

| Variable | Purpose | Value |
|----------|---------|-------|
| `VITE_PROXY_TARGET` | Vite `/api` proxy target inside the Docker network | `http://backend:8000` |
| `CHOKIDAR_USEPOLLING` | Enables polling for reliable HMR on Docker Desktop | `true` |

You do not need to put these in `frontend/.env`; `docker-compose.yml` injects them.
