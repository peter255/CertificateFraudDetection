# Getting Started

Get the full stack running locally with Docker.

## Prerequisites

- Docker Desktop installed and **running**
- Git
- API credentials for at least one verification engine

## Steps

### 1. Clone the repository

```bash
git clone <repository-url>
cd CertificateFraudDetection
```

### 2. Create environment files

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

### 3. Fill in required values

In `backend/.env`, set credentials for the engine you will use:

- **Engine V1:** `TRUTHSCAN_API_KEY`, `TRUTHSCAN_BASE_URL`
- **Engine V2:** `PAPERWORK_API_KEY`, `PAPERWORK_BASE_URL`

In `frontend/.env`, set:

```env
VITE_VERIFICATION_ENGINE=v2
```

Use `v1` or `v2` to match the credentials you configured.

### 4. Start the stack

```bash
docker compose up --build
```

Helpers:

- Windows: `start.bat`
- Linux / macOS: `chmod +x start.sh stop.sh && ./start.sh`

### 5. Verify

| Check | URL |
|-------|-----|
| UI | http://localhost:5173 |
| OpenAPI | http://localhost:8000/docs |
| Health | http://localhost:8000/health |

You should see `{"status":"ok"}` from the health endpoint.

### 6. Stop

```bash
docker compose down
```

Or `stop.bat` / `./stop.sh`.

## Next reading

- [EnvironmentVariables.md](EnvironmentVariables.md)
- [Docker.md](Docker.md)
- [VerificationEngines.md](VerificationEngines.md)
- [Troubleshooting.md](Troubleshooting.md)
