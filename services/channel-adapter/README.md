# Channel Adapter

This service receives inbound messages from external channels and normalizes them
into a single internal contract.

It should own:

- Meta webhook ingress
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
