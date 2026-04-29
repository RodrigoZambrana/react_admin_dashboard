# Analytics Pipeline Hardening

## Estado objetivo

The analytics subsystem now follows a durable pipeline:

`tracking -> ingestion -> persistence -> queue-driven sync -> reporting`

## What changed

- Sync execution moved off the in-memory scheduler.
- A BullMQ queue now drives incremental, initial, backfill, and repair jobs.
- A Redis-based distributed lock serializes sync execution per source + connection.
- Meta delivery is persisted in the same connection/credential model as the other sources.
- `event_facts` now carries canonical attribution columns:
  - `utm_source`
  - `utm_medium`
  - `utm_campaign`
  - `utm_term`
  - `utm_content`
  - `landing_page`
- `analytics_sync_runs` now records operational metadata:
  - `queued_at`
  - `retry_count`
  - `partial_failure_flag`
  - `duration_ms`

## Runtime model

- HTTP API enqueues sync work.
- A separate worker process consumes the queue.
- Repeatable jobs handle:
  - due incremental sync scanning
  - event normalization batches

## Required environment

- `ANALYTICS_QUEUE_URL`
- `QUEUE_REDIS_URL`
- `ANALYTICS_QUEUE_WORKER=true` for the worker process

## Worker command

- `npm run analytics:worker`

## Notes

- If Redis is missing in production, analytics queue initialization fails fast.
- Queue jobs remain idempotent at the storage layer and are also guarded by a distributed lock.
- Meta is still intentionally limited to delivery and measurement readiness, not advanced analysis.
