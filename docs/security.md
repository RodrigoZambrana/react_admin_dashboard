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
