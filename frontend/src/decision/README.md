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

## 2. Why the previous behavior was confusing

Previously the UI could show:

- Status: **Authentic**
- Confidence: **8%**
- Risk: **Medium**

Users read “8%” as “only 8% authentic.” That is incorrect.

The score is the **model’s confidence in its own prediction**, not a measure of how authentic the document is. Showing Authentic next to 8% mixed two different concepts and produced contradictory risk messaging.

## 3. Why “Model Confidence” is more accurate

| Old label | Problem |
|---|---|
| Trust Score | Sounds like “how much we trust this certificate” |

| New label | Meaning |
|---|---|
| **Model Confidence** | How confident the AI model is in the prediction it made |

Example: engine predicts authentic with 8% model confidence → the app does **not** show Authentic. It shows **Suspicious**, Medium Risk, and Model Confidence 8%.

## 4. Decision rules

Thresholds live only in `thresholds.ts` (`DECISION_THRESHOLDS`, `USER_DECISION_RISK`).

| Engine prediction | Model confidence | User status | Trust / Risk |
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

## 5. Files modified / added

**Added**

- `frontend/src/decision/thresholds.ts` — centralized thresholds
- `frontend/src/decision/types.ts` — EnginePrediction / UserDecision
- `frontend/src/decision/decisionEngine.ts` — rule engine
- `frontend/src/decision/index.ts` — public exports
- `frontend/src/decision/README.md` — this document

**Updated**

- `frontend/src/api/verificationApi.ts` — V1/V2 adapters call Decision Engine
- `frontend/src/types/verification.ts` — documents `confidence` as model confidence
- `frontend/src/components/results/VerdictCard.tsx` — Model Confidence label
- `frontend/src/components/results/shared/dashboardShell.tsx` — banner label
- `frontend/src/components/results/VendorAnalysis.tsx` — label
- `frontend/src/utils/downloadReport.ts` — PDF label

**Not changed**

- Vendor integrations
- API contracts / endpoints
- Backend routers and vendor mappers
