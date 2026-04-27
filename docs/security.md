# Security Notes

## Prompt Injection Handling

All user-generated content, channel payloads and message bodies are treated as untrusted input.

Current policy:

- system prompts remain immutable
- AI services may call backend tools only through validated HTTP contracts
- admin-only actions must remain unavailable to customer/public scopes
- external channel payloads must be sanitized before normalization

## Current Observations

- No confirmed prompt injection incident has been detected in this implementation slice
- No security event required escalation during the current iteration
- Development env files under `deploy/env/` are tracked in git and currently carry operational local values for the dev stack.
- `deploy/env/backend.dev.env` is the current source of truth for local development credentials, but it must not be treated as the production boundary.
- Production/testing examples remain placeholder-based; the production secret boundary still needs to stay outside the repository.

## Source Of Truth Map

| Domain | Source of truth | Fallback / bootstrap | Notes |
| --- | --- | --- | --- |
| AI runtime / secure provider config | DB `SecureConfig` | env only if the secret is absent in DB | Production must not depend on tracked env files for these values |
| Local development backend config | `deploy/env/backend.dev.env` | `backend/.env` when developing outside Docker | Dev-only baseline, currently tracked in git for reproducibility |
| Local development frontend/storefront config | `deploy/env/frontend.dev.env`, `deploy/env/storefront.dev.env` | local `.env` files | Dev-only baseline, not production boundary |
| Production / testing secrets | external secret storage or environment injection | placeholder examples only | Must remain outside the repository |

## Production Blockers

- tracked development env files still carry operational values and must not be confused with deploy-time secrets
- production/testing manifests still rely on placeholders and require an external secret source
- any runtime that still falls back to env before DB for sensitive configuration must be treated as incomplete for production
- historical secret reuse must be avoided until the runtime/data boundary is fully normalized

## Ongoing Controls

- keep `x-ai-internal-token` for internal service-to-service reply paths
- keep AI services away from direct DB access
- continue avoiding sensitive logging in AI/channel services

## Follow-up Security Audit

- A minimum protection audit is now a tracked system-wide requirement
- Scope of the audit:
  - authentication and authorization coverage
  - role/scope enforcement
  - rate limiting
  - origin restrictions and CORS exposure
  - public vs internal endpoint boundaries
- This follow-up applies to all backend, admin, storefront, AI and channel endpoints, not only email or inbox-related flows
