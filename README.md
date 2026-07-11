# Certificate Fraud Detection

Professional certificate authenticity verification for demo and evaluation use. Upload a document, run it through a configured verification engine, and review a structured fraud-risk report in the browser.

---

## Project Overview

**What it does**  
Analyzes uploaded certificates and similar documents for authenticity signals, risk indicators, and structured findings. Results are presented in a clean, vendor-independent UI.

**Who it is for**  
Developers, solution architects, and stakeholders evaluating certificate fraud detection workflows—especially for client demos and proof-of-concept deployments.

**Main features**

- Document upload (PDF / image)
- Pluggable verification engines (V1 / V2) selected by configuration
- Structured findings, signals, and risk presentation
- Interactive annotated document view
- FastAPI backend with OpenAPI documentation
- One-command Docker Compose startup

**Architecture summary**  
Clean Architecture layout: a React frontend talks to a FastAPI backend. The backend isolates domain rules from infrastructure (verification engine adapters, storage, optional AI). The UI never depends on a specific provider—only on a configured engine id (`v1` or `v2`).

---

## Project Structure

```
.
├── backend/                 # FastAPI application (Clean Architecture)
│   ├── app/
│   │   ├── domain/          # Entities, enums, value objects, domain services
│   │   ├── application/     # Use cases, DTOs, ports, mappers
│   │   ├── infrastructure/  # Engine adapters, AI, storage, settings
│   │   ├── presentation/    # HTTP API, middleware, dependency wiring
│   │   └── shared/          # Logging, results, shared exceptions
│   ├── Dockerfile
│   ├── .env.example
│   └── requirements.txt
├── frontend/                # React + TypeScript + Vite + MUI
│   ├── src/
│   │   ├── api/             # HTTP client for verification
│   │   ├── components/      # UI building blocks
│   │   ├── config/          # Engine selection (vendor-independent)
│   │   ├── decision/        # Client-side verdict helpers
│   │   ├── pages/           # Application pages
│   │   └── types/           # Shared TypeScript types
│   ├── Dockerfile
│   └── .env.example
├── docs/                    # Extended documentation
├── docker-compose.yml       # Backend + frontend stack
├── start.bat / start.sh     # One-click start
├── stop.bat / stop.sh       # One-click stop
└── README.md
```

---

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- Git

### 1. Clone

```bash
git clone <repository-url>
cd CertificateFraudDetection
```

### 2. Configure environment variables

**Windows**

```bat
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

**Linux / macOS**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` and set at least the API key and base URL for the engine you will use (see [Environment Variables](#environment-variables)).

Edit `frontend/.env` and set `VITE_VERIFICATION_ENGINE` to `v1` or `v2`.

> The `start` scripts copy missing `.env` files from `.env.example` automatically. You still must fill in real API credentials.

### 3. Run

```bash
docker compose up --build
```

Or use the helper scripts:

| Platform       | Start        | Stop       |
|----------------|--------------|------------|
| Windows        | `start.bat`  | `stop.bat` |
| Linux / macOS  | `./start.sh` | `./stop.sh` |

### 4. Open

| Surface        | URL                                      |
|----------------|------------------------------------------|
| Frontend       | http://localhost:5173                    |
| Backend API    | http://localhost:8000/docs               |
| Health         | http://localhost:8000/health             |

---

## Environment Variables

Full reference: [docs/EnvironmentVariables.md](docs/EnvironmentVariables.md).

### `backend/.env`

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `APP_HOST` | Bind address | `0.0.0.0` | Optional |
| `APP_PORT` | Listen port | `8000` | Optional |
| `TRUTHSCAN_API_KEY` | API key for **Verification Engine V1** | `your-key` | Yes if using V1 |
| `TRUTHSCAN_BASE_URL` | Base URL for Engine V1 | `https://…` | Yes if using V1 |
| `TRUTHSCAN_TIMEOUT` | Engine V1 timeout (seconds) | `60` | Optional |
| `PAPERWORK_API_KEY` | API key for **Verification Engine V2** | `your-key` | Yes if using V2 |
| `PAPERWORK_BASE_URL` | Base URL for Engine V2 | `https://…` | Yes if using V2 |
| `PAPERWORK_TIMEOUT` | Engine V2 timeout (seconds) | `300` | Optional |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key | `…` | Optional |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint | `https://….openai.azure.com/` | Optional |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment / model name | `gpt-4o` | Optional |

> Config key prefixes in `.env` are legacy adapter identifiers. In product documentation and the UI they are always **Verification Engine V1** and **Verification Engine V2**.

### `frontend/.env`

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `VITE_API_BASE_URL` | Host-facing backend URL (proxy fallback) | `http://localhost:8000` | Optional |
| `VITE_VERIFICATION_ENGINE` | Active engine (`v1` or `v2`) | `v2` | Yes |

---

## Verification Engines

The platform supports two pluggable engines:

| Config value | Name | API route |
|--------------|------|-----------|
| `v1` | Verification Engine V1 | `POST /api/v1/vendors/v1/verify` |
| `v2` | Verification Engine V2 | `POST /api/v1/vendors/v2/verify` |

- The **active engine** is selected with `VITE_VERIFICATION_ENGINE` in `frontend/.env`.
- Backend credentials for each engine live in `backend/.env`.
- The **UI is vendor-independent**—switching engines does not require UI code changes.
- See [docs/VerificationEngines.md](docs/VerificationEngines.md).

---

## Architecture

```
Frontend (React)  →  Presentation (FastAPI)  →  Application (use cases)
                                                    ↓
                                              Domain (rules)
                                                    ↑
                                         Infrastructure (engines, AI, storage)
```

| Layer | Responsibility |
|-------|----------------|
| **Frontend** | Upload UX, results presentation, engine selection via env |
| **Presentation** | HTTP routes, middleware, dependency injection |
| **Application** | Use cases and ports (interfaces) |
| **Domain** | Entities and business rules (no framework deps) |
| **Infrastructure** | Engine clients, mappers, settings, storage |

Dependency rule: outer layers depend inward; domain has no outward dependencies.

Details: [docs/Architecture.md](docs/Architecture.md).

---

## Development Workflow

| Task | Command / action |
|------|------------------|
| **Start** | `docker compose up --build` or `start.bat` / `./start.sh` |
| **Stop** | `docker compose down` or `stop.bat` / `./stop.sh` |
| **Rebuild** | `docker compose build --no-cache` then `docker compose up` |
| **Update Python deps** | Edit `backend/requirements.txt`, then rebuild the backend image |
| **Update Node deps** | Edit `frontend/package.json`, run `npm install` locally to refresh the lockfile, then rebuild |
| **Switch engines** | Set `VITE_VERIFICATION_ENGINE=v1` or `v2` in `frontend/.env`, restart frontend |
| **Configure API keys** | Edit `backend/.env`, restart backend |

Hot reload is enabled for both services via Compose volume mounts.

More: [docs/GettingStarted.md](docs/GettingStarted.md) · [docs/Docker.md](docs/Docker.md).

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Docker Desktop not running | Start Docker Desktop and wait until it is healthy |
| Port 8000 or 5173 in use | Stop the other process, or change the host port mapping in `docker-compose.yml` |
| Missing `.env` | Copy from `.env.example` (or run `start.bat` / `./start.sh`) |
| Invalid API key | Confirm the key and base URL for the active engine in `backend/.env` |
| Container won’t start | `docker compose logs backend` / `docker compose logs frontend` |
| Stale build cache | `docker compose build --no-cache` |

Full guide: [docs/Troubleshooting.md](docs/Troubleshooting.md).

---

## Future Extensions

To add **Verification Engine V3**:

1. Implement an infrastructure adapter (client + mapper) behind the existing verification port.
2. Register a presentation route under `/api/v1/vendors/v3/verify`.
3. Add engine credentials to `backend/.env` / settings.
4. Extend frontend `VITE_VERIFICATION_ENGINE` to accept `v3` and map the path in `src/config/vendors.ts`.

No UI redesign is required if the response is mapped to the shared result model.

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/Architecture.md](docs/Architecture.md) | Layers and dependency flow |
| [docs/GettingStarted.md](docs/GettingStarted.md) | Clone → configure → run |
| [docs/Docker.md](docs/Docker.md) | Compose services and networking |
| [docs/EnvironmentVariables.md](docs/EnvironmentVariables.md) | Full env reference |
| [docs/VerificationEngines.md](docs/VerificationEngines.md) | Engine selection and extension |
| [docs/Troubleshooting.md](docs/Troubleshooting.md) | Common failures |
| [docs/API.md](docs/API.md) | HTTP API overview |

---

## License

Proprietary — internal / demo use unless otherwise stated by the project owner.
