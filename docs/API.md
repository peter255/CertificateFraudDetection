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
| `pdf_structure_summary` | Azure OpenAI cross-check of vendor identity/signals vs Document Intelligence OCR + PDF metadata/structure (falls back to local PDF Structure summary if Azure is unavailable) |
| `pdf_structure_findings` | Structured findings (`rule_id`, `severity`, `status`, `title`, `description`, `evidence`, `recommendation`, `confidence`) |

After vendor verify, the backend runs PDF Structure Analysis, then sends **vendor fields + OCR/structure results** to Azure OpenAI to match holder/issuer/dates, note file-structure observations, and produce this short mismatch/agreement summary.

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

#### Request (cURL)

```bash
curl -X POST "http://localhost:8000/api/v1/pdf-structure/analyze" ^
  -H "Accept: application/json" ^
  -F "file=@C:\path\to\certificate.pdf;type=application/pdf"
```

Linux / macOS / Git Bash:

```bash
curl -X POST "http://localhost:8000/api/v1/pdf-structure/analyze" \
  -H "Accept: application/json" \
  -F "file=@./certificate.pdf;type=application/pdf"
```

Swagger UI (easiest): open http://localhost:8000/docs → **pdf-structure** → `POST /api/v1/pdf-structure/analyze` → **Try it out** → upload file → **Execute**.

#### Request (PowerShell)

```powershell
$form = @{
  file = Get-Item -Path "C:\path\to\certificate.pdf"
}
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8000/api/v1/pdf-structure/analyze" `
  -Form $form | ConvertTo-Json -Depth 10
```

#### Response example (Document Intelligence working)

When Azure Document Intelligence is configured correctly, look for `"ocr": true` and populated `ocr_fields`:

```json
{
  "status": "completed",
  "findings": [
    {
      "rule_id": "OCR_MISSING_IMPORTANT_FIELDS",
      "severity": "info",
      "status": "pass",
      "title": "Important OCR fields present",
      "description": "Holder, issuer, and date fields were extracted.",
      "evidence": {},
      "recommendation": "",
      "confidence": 0.7
    }
  ],
  "ocr_fields": {
    "holder_name": "Jane Doe",
    "certificate_name": "Certificate of Completion",
    "issuer": "Contoso Academy",
    "award_date": null,
    "issue_date": "2024-06-15",
    "expiration_date": null,
    "certificate_id": "CERT-12345",
    "qr_code": null,
    "detected_text": "Certificate of Completion Holder Name: Jane Doe Issuer: Contoso Academy ...",
    "key_value_pairs": {
      "Holder Name": "Jane Doe",
      "Issuer": "Contoso Academy",
      "Issue Date": "2024-06-15",
      "Certificate ID": "CERT-12345"
    },
    "raw": {
      "api": "azure_document_intelligence",
      "page_count": 1,
      "has_key_value_pairs": true,
      "analyzeResult": {
        "apiVersion": "2024-11-30",
        "modelId": "prebuilt-layout",
        "content": "Certificate of Completion ...",
        "pages": [
          {
            "pageNumber": 1,
            "width": 8.5,
            "height": 11,
            "unit": "inch",
            "words": [
              {
                "content": "Jane",
                "polygon": [1.0, 2.0, 1.5, 2.0, 1.5, 2.3, 1.0, 2.3],
                "confidence": 0.99,
                "span": { "offset": 0, "length": 4 }
              }
            ],
            "lines": [
              {
                "content": "Jane Doe",
                "polygon": [1.0, 2.0, 2.2, 2.0, 2.2, 2.3, 1.0, 2.3],
                "spans": [{ "offset": 0, "length": 8 }]
              }
            ]
          }
        ],
        "keyValuePairs": [],
        "styles": [],
        "languages": []
      }
    }
  },
  "pdf_metadata": {
    "creation_date": "2024-06-15T10:00:00",
    "modification_date": "2024-06-15T10:00:00",
    "producer": "Example PDF Producer",
    "creator": null,
    "pdf_version": "1.4",
    "page_count": 1,
    "file_size": 24510,
    "title": null,
    "author": null,
    "subject": null,
    "keywords": null,
    "document_properties": {},
    "is_pdf": true,
    "parse_error": null
  },
  "summary": "PDF Structure Analysis completed with OCR and metadata stages.",
  "analyzed_at": "2026-07-15T08:30:00.123456Z",
  "duration_ms": 3200,
  "sources": {
    "ocr": true,
    "metadata": true,
    "rules": true,
    "llm": false
  }
}
```

#### How to confirm Document Intelligence yourself

| Signal | Meaning |
|--------|---------|
| `sources.ocr: true` | Azure Document Intelligence ran and contributed |
| `ocr_fields.holder_name` / `issuer` / dates filled | OCR mapping worked |
| `ocr_fields.key_value_pairs` not empty | Layout + keyValuePairs feature worked |
| `sources.ocr: false` and empty `ocr_fields` | Endpoint/key missing or OCR skipped |
| `ocr_fields.raw.error` present | OCR was attempted but failed (check backend logs) |

## OpenAPI

- Swagger UI: http://localhost:8000/docs  
- ReDoc: http://localhost:8000/redoc  

Prefer those pages for live schemas while the server is running.
