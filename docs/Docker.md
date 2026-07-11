# Docker

How the Compose stack is organized and how containers talk to each other.

## Services

| Service | Container name | Host port | Role |
|---------|----------------|-----------|------|
| `backend` | `cfd-backend` | `8000` | FastAPI + Uvicorn (reload) |
| `frontend` | `cfd-frontend` | `5173` | Vite dev server (HMR) |

Restart policy: `unless-stopped` for both.

## Networking

- Compose places both services on the default project network.
- The frontend **browser** calls relative `/api/...` URLs (same origin as Vite).
- Vite proxies `/api` to the backend container via `VITE_PROXY_TARGET=http://backend:8000`.
- From the host machine, open:
  - Frontend: `http://localhost:5173`
  - Backend: `http://localhost:8000`

Do **not** point the browser at `http://backend:8000`—that hostname only resolves inside the Docker network.

## Hot reload

Source mounts enable live reload without rebuilding images:

- Backend: `./backend/app` → `/app/app` with `uvicorn --reload`
- Frontend: `./frontend/src` (and related files) with Vite HMR  
  `CHOKIDAR_USEPOLLING=true` improves file watching on Docker Desktop.

## Common commands

```bash
# Start (build if needed)
docker compose up --build

# Detached
docker compose up --build -d

# Logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop and remove containers
docker compose down

# Full rebuild (ignore cache)
docker compose build --no-cache
docker compose up
```

## Images

- `backend/Dockerfile` — Python 3.13 slim, installs `requirements.txt`, exposes `8000`, includes a healthcheck.
- `frontend/Dockerfile` — Node 22 Alpine, `npm ci`, runs Vite on `0.0.0.0:5173`.

Both Dockerfiles are suitable for local development Compose. For a hardened production deploy you would typically add a multi-stage frontend build served by a static web server; that is intentionally out of scope for the demo stack.
