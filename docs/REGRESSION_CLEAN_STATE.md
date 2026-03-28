# Regression Clean State

## Goal

Leave the environment in a predictable state for:

- exploratory testing
- regression runs
- demo/test environments with minimal valid data

This process is intentionally conservative:

- it preserves real baseline/system configuration
- it preserves the configured operational inbox account
- it removes synthetic conversation/email artifacts created during testing

## Command

```bash
cd /Users/rodrigo/git/personal/react_admin_dashboard/backend
npm run regression:prepare
```

Apply cleanup explicitly:

```bash
cd /Users/rodrigo/git/personal/react_admin_dashboard/backend
npm run regression:prepare:apply
```

Direct CLI examples:

```bash
cd /Users/rodrigo/git/personal/react_admin_dashboard/backend
sh scripts/prepare-regression-state.sh --dry-run
sh scripts/prepare-regression-state.sh --confirm
```

## Safety Guards

This script is intentionally protected so it cannot become an accidental or externally exposed destructive path.

Current guarantees:

- it is a CLI-only maintenance script; there is no HTTP/controller route that invokes it
- it is blocked in `production / prod / live` environments
- it is blocked against non-local database hosts by default
- destructive execution requires explicit `--confirm`
- the default npm path is now `dry-run`

Local database hosts currently allowed by default:

- `localhost`
- `127.0.0.1`
- `::1`
- `postgres-local`
- `codex-local-postgres`
- `host.docker.internal`

Remote execution is blocked unless someone deliberately sets:

```bash
ALLOW_REMOTE_MAINTENANCE=true
```

Even with that override, production environments remain blocked.

## What The Script Cleans

- synthetic email conversations with subjects such as:
  - `Reply email ...`
  - `Consulta email ...`
  - `Probe email webhook`
- conversations tied to invalid/non-operational email inbox accounts
- conversation-derived knowledge artifacts attached to those synthetic conversations:
  - `KnowledgeRawEvent`
  - `KnowledgeCandidate`
  - `KnowledgeSuggestionFeedback`
  - `KnowledgeConversationBundle`
  - related `KnowledgeNegativeExample`
- synthetic `InboxMessage` rows for those subjects/accounts

## What The Script Preserves

- baseline/system configuration
- approved documents and active knowledge unrelated to the synthetic tests
- the configured operational mailbox defined by:
  - `INBOX_EMAIL_DEFAULT_FROM`
  - fallback: `INBOX_EMAIL_USER`

## Current Validity Rule For Email Inbox Accounts

An email inbox account is considered operable only if:

1. it is active
2. it is the configured operational mailbox or it has complete stored IMAP/SMTP/default sender metadata
3. it contains minimum connectivity proof in metadata:
   - `smtpTlsVerifiedAt`
   - `imapTlsVerifiedAt`
   - `smtpVerifyVerifiedAt`

Accounts that do not pass that rule:

- must not be listed as operational inbox accounts in admin
- must not be auto-selected for inbound email ingestion

## Minimum Validation Required To Mark An Email Account As Valid

Before treating a mailbox as operational, run and record:

1. TLS connectivity to SMTP host/port
2. TLS connectivity to IMAP host/port
3. `nodemailer.verify()` with the configured credentials

Example that was validated in this environment:

- TLS to `mail.software-strategy.com:465`: OK
- TLS to `mail.software-strategy.com:993`: OK
- `nodemailer.verify()` with configured credentials: OK

## Recommended Metadata Shape

```json
{
  "validation": {
    "smtpTlsVerifiedAt": "2026-03-27T20:10:00.000Z",
    "imapTlsVerifiedAt": "2026-03-27T20:10:00.000Z",
    "smtpVerifyVerifiedAt": "2026-03-27T20:10:00.000Z",
    "verifiedAt": "2026-03-27T20:10:00.000Z",
    "verifiedBy": "manual-regression-prepare"
  }
}
```

## Operational Notes

- Do not create placeholder email inbox accounts from incoming payloads.
- Do not expose an email mailbox in admin just because an `InboxAccount` row exists.
- If an invalid mailbox was created historically, keep it inactive or remove it once there are no dependent records.
- Apply the same safety standard to other critical maintenance scripts:
  - `scripts/bootstrap-fresh-local-db.sh`
  - `scripts/reset-admin.ts`
  - any future script that resets data, credentials, queues, or knowledge state

## Suggested Future Automation

The clean-state process can evolve into a fuller pre-regression pipeline:

1. `npm run regression:prepare -- --dry-run`
2. confirm counts
3. execute cleanup
4. restart backend/AI/channel-adapter/storefront/admin
5. smoke checks:
   - backend health
   - inbox configured account visible
   - AI runtime health
   - storefront chat opens and sends

That future automation should still preserve real system configuration and only remove clearly synthetic artifacts.
