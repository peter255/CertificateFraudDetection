# Decision Engine

Converts a verification engine prediction into the user-facing verification result.

## 1. Decision flow

```
Verification Engine V1 / V2
        │
        │  technical prediction + model confidence
        ▼
  Adapter (verificationApi mapEngineV*)
        │
        │  EnginePrediction { label, modelConfidence }
        ▼
  Decision Engine (decideUserVerdict)
        │
        │  UserDecision { verdict, modelConfidence, risk*, recommendation }
        ▼
  UI / PDF (Trusted | Suspicious | Fraudulent)
```

Engines return a **technical** classification. The Decision Engine owns the **business** decision shown to the user. UI never reads raw engine status for the final badge.

## 2. Three score concepts (do not conflate)

| Score | Meaning | Source |
|---|---|---|
| **Model Confidence** | How sure the model is about its own prediction | V1 `confidence_score`; V2 fraud-derived / explicit confidence — never `trust_score` |
| **Engine Trust Score** | Engine-assessed document trustworthiness | V2 `llm_report.trust_score` (and similar keys) → `result.engineTrustScore` |
| **Decision trust / risk** | Business mapping from verdict (`report.trustScore` 100/50/0 + risk level) | Decision Engine only — used for risk badge, not the Trust Score gauge |

| Related | Meaning |
|---|---|
| **AI Detection** (`aiDetection`) | Vendor-agnostic AI-generation signal from **explicit** engine fields only | Normalized in `utils/aiDetection.ts` via V1/V2 mappers → `result.aiDetection`. **V1:** `/query.result` is the vendor **Core AI score** → `aiDetection.probability`, plus classification labels (`final_result` / `ml_label`). **V2:** `layer_details.c2pa.metadata.ai_generated` (boolean); live API has **no** numeric AI probability field. Never derived from trust, risk, or verdict. |

Example: engine predicts authentic with 8% model confidence → the app does **not** show Trusted. It shows **Suspicious**, Medium Risk, and Model Confidence 8%.

## 3. Decision rules

Thresholds live only in `thresholds.ts` (`DECISION_THRESHOLDS`, `USER_DECISION_RISK`).

| Engine prediction | Model confidence | User status | Decision trust / Risk |
|---|---|---|---|
| Authentic | ≥ `AUTHENTIC_MIN_CONFIDENCE` (40) | Trusted | Trust 100 / Low Risk |
| Authentic | < 40 | Suspicious | Trust 50 / Medium Risk |
| Suspicious / inconclusive | any | Suspicious | Trust 50 / Medium Risk |
| Fraudulent / forgery / edited | any | Fraudulent | Trust 0 / High Risk |

Recommendations follow the user status:

- Trusted → approve
- Suspicious → manual_review
- Fraudulent → reject

Combinations that must never appear:

- Trusted + low model confidence
- Trusted + High Risk
- Fraudulent + Low Risk

## 4. Files

**Added**

- `frontend/src/decision/thresholds.ts` — centralized thresholds
- `frontend/src/decision/types.ts` — EnginePrediction / UserDecision
- `frontend/src/decision/decisionEngine.ts` — rule engine
- `frontend/src/decision/index.ts` — public exports
- `frontend/src/decision/README.md` — this document

**Updated**

- `frontend/src/api/verificationApi.ts` — V1/V2 adapters call Decision Engine; map `aiDetection` / `engineTrustScore`
- `frontend/src/utils/aiDetection.ts` — vendor-agnostic AI field extraction (explicit keys / labels only)
- `frontend/src/types/verification.ts` — documents score fields + `AiDetection`
- `frontend/src/components/results/VerdictCard.tsx` — AI Generated Content strip + Model Confidence / AI Probability / Trust Score gauges
- `frontend/src/utils/downloadReport.ts` — PDF labels + glossary

**Not changed**

- Vendor integrations
- API contracts / endpoints
- Backend routers and vendor mappers
