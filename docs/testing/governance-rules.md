# QA Governance Rules

These rules are enforced to eliminate false green states.

- A spec reference must resolve to at least one real file, not a directory placeholder.
- A command that expands to zero files is a failure.
- A critical suite cannot contain `.skip` markers in any resolved target.
- Workbook rows marked `VERIFICADA`, `valid`, `passing`, or `automated` must contain at least one executable evidence artifact.
- Docs, source files, directories, and globs can supplement traceability, but they do not count as executable proof on their own.
- Evidence that only points to deferred AI / chat-platform scopes cannot satisfy the core workbook gate.
- Workbook evidence cannot use wildcards as the only reference for a green claim.
- Coverage without runtime integrity does not count.
