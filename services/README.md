# Services Workspace

This folder contains optional runtime services that remain decoupled from the core commerce stack.

## Services

- [ai-agent-service](/Users/rodrigo/git/personal/react_admin_dashboard/services/ai-agent-service)
  - conversational runtime
  - provider abstraction
  - memory drivers
  - backend tool execution through `/api/ai/*`
- [channel-adapter](/Users/rodrigo/git/personal/react_admin_dashboard/services/channel-adapter)
  - channel normalization
  - inbound webhook handling
  - routing into the canonical conversation hub

## Rule

- These services never talk directly to PostgreSQL.
- Backend remains the source of truth for business rules and persistent state.
