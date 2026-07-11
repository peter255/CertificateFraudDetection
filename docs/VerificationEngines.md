# Verification Engines

The platform integrates verification providers through a stable, vendor-independent contract.

## Available engines

| Id | Display name | Backend route |
|----|--------------|---------------|
| `v1` | Verification Engine V1 | `POST /api/v1/vendors/v1/verify` |
| `v2` | Verification Engine V2 | `POST /api/v1/vendors/v2/verify` |

## How selection works

1. **Frontend** reads `VITE_VERIFICATION_ENGINE` (`v1` or `v2`).
2. The UI calls the matching `/vendors/v{n}/verify` path.
3. **Backend** uses the corresponding infrastructure adapter and credentials from `backend/.env`.

The UI never imports provider SDKs or provider-specific branding. Switching engines is a configuration change.

## Configure credentials

- Engine V1 → `TRUTHSCAN_API_KEY`, `TRUTHSCAN_BASE_URL`, optional `TRUTHSCAN_TIMEOUT`
- Engine V2 → `PAPERWORK_API_KEY`, `PAPERWORK_BASE_URL`, optional `PAPERWORK_TIMEOUT`

Restart the backend container after changing credentials.

## Switch the active engine

1. Edit `frontend/.env`: `VITE_VERIFICATION_ENGINE=v1` or `v2`
2. Ensure matching credentials exist in `backend/.env`
3. Restart the frontend (Compose restart or save + HMR may reload env on container restart)

## Adding Verification Engine V3

High-level steps (no provider names required):

1. **Infrastructure** — Add a client + mapper under `backend/app/infrastructure/vendors/…` implementing the same verification port pattern as V1/V2.
2. **Settings** — Add env vars for the new engine’s API key, base URL, and timeout.
3. **Presentation** — Register `POST /api/v1/vendors/v3/verify`.
4. **Frontend** — Extend `VerificationEngineId` and path/display maps in `frontend/src/config/vendors.ts`; allow `v3` in `VITE_VERIFICATION_ENGINE`.
5. **Docs** — Document the new variables in `.env.example` and this file.

Map the provider response into the shared frontend result model so existing result components keep working.
