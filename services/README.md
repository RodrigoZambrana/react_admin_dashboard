# Services Workspace

This folder contains adapter services that remain decoupled from the core commerce stack.

## Services

- [channel-adapter](/Users/rodrigo/git/personal/react_admin_dashboard/services/channel-adapter)
  - channel normalization
  - inbound webhook handling
  - routing into the canonical ai-platform conversation hub

## Rule

- These services never talk directly to PostgreSQL.
- ai-platform remains the source of truth for chat runtime, channel control, and conversation state.
