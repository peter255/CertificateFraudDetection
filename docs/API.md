# API

HTTP surface exposed by the backend. Interactive docs: http://localhost:8000/docs

## Base URL

| Context | URL |
|---------|-----|
| Host machine | `http://localhost:8000` |
| Frontend (browser via Vite proxy) | `/api/...` → proxied to backend |

## Health

```
GET /health
```

Response:

```json
{ "status": "ok" }
```

Used by Docker healthchecks and manual smoke tests.

## Verification

All verification routes are under `/api/v1`.

### Verification Engine V1

```
POST /api/v1/vendors/v1/verify
Content-Type: multipart/form-data
```

| Field | Type | Notes |
|-------|------|-------|
| `file` | file | Certificate PDF/PNG/JPEG |
| `holder_name` | form | Optional |
| `issuer_name` | form | Optional |
| `document_type` | form | Optional category |

### Verification Engine V2

```
POST /api/v1/vendors/v2/verify
Content-Type: multipart/form-data
```

| Field | Type | Notes |
|-------|------|-------|
| `file` | file | Certificate document |
| `document_type` | form | Optional |
| `ocr_mode` | form | Optional |

Exact response schemas are defined in the OpenAPI UI (`/docs`) and the presentation/infrastructure models.

## OpenAPI

- Swagger UI: http://localhost:8000/docs  
- ReDoc: http://localhost:8000/redoc  

Prefer those pages for live schemas while the server is running.
