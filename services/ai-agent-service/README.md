# AI Agent Service

This service is the optional AI runtime for the project.

It should own:

- model provider abstraction
- tools
- hot memory
- prompt orchestration
- guardrails
- audit-safe decision logging

Recommended tree:

```txt
services/ai-agent-service
├── Dockerfile
├── package.json
└── src
    ├── main.js
    ├── ai/
    │   ├── agent.ts
    │   ├── tools/
    │   ├── memory/
    │   ├── model/
    │   └── guardrails/
    ├── application/
    ├── clients/
    └── observability/
```

The canonical conversation history stays in backend/Postgres.
This service should only manage hot memory and orchestration state.
