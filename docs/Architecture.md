# Architecture

Concise overview of how the Certificate Fraud Detection system is structured.

## High-level view

```
┌─────────────────┐     HTTP /api/v1      ┌──────────────────────┐
│  Frontend       │ ───────────────────►  │  Backend (FastAPI)   │
│  React + Vite   │ ◄───────────────────  │  Presentation layer  │
└─────────────────┘                       └──────────┬───────────┘
                                                     │
                                          Application use cases
                                                     │
                                              Domain model
                                                     ▲
                                          Infrastructure adapters
                                          (engines, AI, storage)
```

## Layers

### Frontend

- React + TypeScript + Material UI
- Uploads documents and renders verification results
- Selects the active engine via `VITE_VERIFICATION_ENGINE` (`v1` | `v2`)
- Remains vendor-independent; display names are generic (“Analysis V1 / V2”)

### Presentation

- FastAPI routers, CORS, logging middleware, exception handlers
- Wires HTTP requests to use cases / engine clients through dependencies
- Exposes OpenAPI at `/docs` and health at `/health`

### Application

- Use cases, DTOs, ports (interfaces), and mappers
- Orchestrates verification without knowing HTTP or vendor SDKs

### Domain

- Entities, value objects, enums, and domain services
- No framework or vendor imports

### Infrastructure

- Verification Engine V1 / V2 HTTP clients and response mappers
- Optional Azure OpenAI adapter
- Settings loaded from environment variables
- Storage adapters

## Dependency flow

Dependencies point **inward**:

1. Presentation → Application → Domain  
2. Infrastructure → Application ports / Domain types  
3. Domain never imports Infrastructure or Presentation  

Adding a new engine means a new infrastructure adapter plus a thin presentation route—not changes to domain rules or the core UI contract.
