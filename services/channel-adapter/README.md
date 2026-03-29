# Channel Adapter

This service receives inbound messages from external channels and normalizes them
into a single internal contract.

It should own:

- Meta webhook ingress
- Meta webhook verification/signature validation
- Meta outbound sender for Messenger/Instagram
- email ingress/egress adapters
- webchat ingress
- outbound dispatch per channel
- payload sanitization

Recommended tree:

```txt
services/channel-adapter
├── Dockerfile
├── package.json
└── src
    ├── main.js
    ├── normalization/
    ├── channels/meta/
    ├── channels/email/
    ├── channels/webchat/
    ├── clients/
    └── delivery/
```

This service should not contain business rules for orders, budgets, products, or
permissions. Those stay in backend.

Meta MVP in this repo:

- `GET /webhooks/meta`: verify token + challenge response
- `POST /webhooks/meta`: validate `X-Hub-Signature-256` / `X-Hub-Signature`, normalize
  Messenger or Instagram events, ingest them into the conversation hub, and let the
  runtime generate outbound responses
- `POST /dispatch/meta`: send outbound text / quick replies / basic attachments via
  Meta Send API

Environment variables:

- `META_VERIFY_TOKEN` or `VERIFY_TOKEN`
- `META_APP_SECRET` or `APP_SECRET`
- `META_PAGE_ACCESS_TOKEN` or `PAGE_ACCESS_TOKEN`
- `MESSENGER_PAGE_ACCESS_TOKEN`
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- `META_GRAPH_VERSION`
- `META_SENDER_MAX_RETRIES`
