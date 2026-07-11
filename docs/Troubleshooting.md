# Troubleshooting

Common setup issues and how to fix them.

## Docker Desktop is not running

**Symptoms:** `error during connect` / `Cannot connect to the Docker daemon`

**Fix:** Start Docker Desktop and wait until the engine status is running, then retry `docker compose up --build`.

---

## Port already in use

**Symptoms:** `Bind for 0.0.0.0:8000 failed` or `:5173 failed`

**Fix:**

- Stop the process using the port, or
- Change the left-hand side of the port mapping in `docker-compose.yml` (e.g. `"8001:8000"`), and open the new host port in the browser.

---

## Missing `.env`

**Symptoms:** Empty credentials, 401/403 from engines, or Compose warning about missing env file

**Fix:**

```bat
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Or run `start.bat` / `./start.sh`, which creates missing files, then edit them.

---

## Invalid API key / engine errors

**Symptoms:** Verification fails with auth or “missing key” style errors

**Fix:**

1. Confirm `VITE_VERIFICATION_ENGINE` matches the credentials you filled in.
2. Check API key and base URL (no trailing issues, no quotes unless required).
3. Restart backend: `docker compose restart backend`
4. Inspect logs: `docker compose logs backend`

---

## Container won’t start

**Fix:**

```bash
docker compose ps
docker compose logs backend
docker compose logs frontend
```

Look for missing modules, syntax errors, or failed healthchecks. Fix the reported error, then `docker compose up --build`.

---

## Build cache issues

**Symptoms:** Dependency changes not picked up; odd stale behavior after `package.json` / `requirements.txt` edits

**Fix:**

```bash
docker compose build --no-cache
docker compose up
```

---

## Frontend loads but API calls fail

**Symptoms:** Network errors on verify; proxy failures in Vite logs

**Fix:**

1. Confirm backend health: http://localhost:8000/health
2. Confirm `cfd-backend` is healthy: `docker compose ps`
3. Inside Compose, proxy target must be `http://backend:8000` (set automatically)
4. For non-Docker local Vite, proxy defaults to `http://localhost:8000`

---

## Hot reload not detecting file changes (Windows / macOS)

**Fix:** Compose already sets `CHOKIDAR_USEPOLLING=true`. If changes still miss, restart the frontend container:

```bash
docker compose restart frontend
```

---

## Permission denied on `./start.sh`

**Fix:**

```bash
chmod +x start.sh stop.sh
./start.sh
```
