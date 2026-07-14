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

V1/V2 verify responses may also include optional PDF Structure enrichment fields:

| Field | Notes |
|-------|-------|
| `pdf_structure_summary` | Short forensic summary of PDF/metadata/OCR indicators |
| `pdf_structure_findings` | Structured findings (`rule_id`, `severity`, `status`, `title`, `description`, `evidence`, `recommendation`, `confidence`) |

### PDF Structure Analysis

Standalone forensic pipeline (OCR + PDF metadata + rules + optional LLM). Does **not** return a fraud verdict.

```
POST /api/v1/pdf-structure/analyze
Content-Type: multipart/form-data
```

| Field | Type | Notes |
|-------|------|-------|
| `file` | file | PDF/PNG/JPEG |

Requires `AZURE_DOCUMENT_INTELLIGENCE_*` for OCR (optional) and `AZURE_OPENAI_*` for LLM consistency checks (optional). Metadata/rules still run without them.

## OpenAPI

- Swagger UI: http://localhost:8000/docs  
- ReDoc: http://localhost:8000/redoc  

Prefer those pages for live schemas while the server is running.
