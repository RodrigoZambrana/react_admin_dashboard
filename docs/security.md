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
