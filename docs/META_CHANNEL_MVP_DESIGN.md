# Meta Channel MVP

## Goal

Integrate Instagram Messaging and Facebook Messenger as pure transport channels.
The Meta adapter receives webhook events, normalizes them into the internal
conversation contract, hands them to the existing AI runtime, and sends outbound
responses back through Meta Send API.

The runtime remains the conversational core.

## Implemented structure

```txt
services/channel-adapter/src/channels/meta
├── meta.adapter.js
├── meta.sender.js
├── meta.webhook.js
├── meta.adapter.test.js
└── meta.sender.test.js
```

## Public endpoints

- `GET /webhooks/meta`
  - verifies `hub.verify_token`
  - returns `hub.challenge`
- `POST /webhooks/meta`
  - validates `X-Hub-Signature-256` / `X-Hub-Signature`
  - accepts Messenger and Instagram webhook payloads
  - normalizes messages, postbacks and attachments
  - ingests them into the conversation hub
  - calls the AI runtime
- `POST /dispatch/meta`
  - internal-only dispatch route for outbound Meta messages

## Required environment variables

- `META_VERIFY_TOKEN` or `VERIFY_TOKEN`
- `META_APP_SECRET` or `APP_SECRET`
- `META_PAGE_ACCESS_TOKEN` or `PAGE_ACCESS_TOKEN`
- `MESSENGER_PAGE_ACCESS_TOKEN`
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- `META_GRAPH_VERSION`
- `META_SENDER_MAX_RETRIES`

## Inbound flow

```txt
Meta Webhook
-> channel-adapter /webhooks/meta
-> signature verification
-> meta.webhook.js event extraction
-> meta.adapter.js normalization
-> backend /conversations/internal/inbound
-> ai-agent-service /respond
-> backend /conversations/:id/agent-reply
-> channel-adapter /dispatch/meta
-> Meta Send API
```

## Internal normalized payload

```json
{
  "tenantKey": "urucortinas",
  "channel": "instagram",
  "userId": "1784...",
  "threadId": "1784...",
  "inboxAddress": "page-or-ig-account-id",
  "messageId": "mid.abc",
  "text": "Hola",
  "attachments": [],
  "metadata": {
    "transport": "meta",
    "provider": "meta-graph",
    "platform": "instagram",
    "eventType": "message"
  }
}
```

## Outbound support

Current sender support:

- text
- quick replies
- basic attachment payload passthrough
- retry on `429` and `5xx`

## Scope notes

This slice intentionally does not add business logic, intent logic, or tenant
rules to the Meta adapter.

## Next phases

## Activation pending

Before Messenger and Instagram can operate end-to-end in production-like mode,
the following external activation steps must be completed:

- define a real public base URL for the `channel-adapter`
- register `https://<public-base-url>/webhooks/meta` in Meta as the webhook
  `Callback URL`
- use the exact same `Verify Token` in Meta and in the secure channel
  configuration
- subscribe the Meta app to the required Messenger and Instagram webhook events

These are operational pending items, not runtime/business-logic gaps.

### Phase 2

- richer attachment handling and download helpers
- reply templates
- delivery/read event sync for Messenger/Instagram
- profile enrichment for sender display names

### Phase 3

- channel settings UI for Meta tokens and health
- metrics by platform
- helpdesk synchronization
- advanced channel actions and operator tools
