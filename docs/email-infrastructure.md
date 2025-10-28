# Unified Email Infrastructure

This document explains how to configure and operate the new transactional email stack that powers both the admin frontend and the customer storefront.

## Overview

The backend exposes a provider-agnostic email service that renders MJML templates, persists audit logs, and delivers messages via a pluggable transport. Messages are queued through BullMQ so they can be retried with exponential backoff and inspected from the admin UI. Administrators can manage sender information, routing rules, and delivery logs under **Settings → Email** in the dashboard.

The following flows emit emails automatically:

- Order confirmations created from the admin suite or the storefront checkout.
- Payment confirmations for balance and refund events.
- Password reset requests for both admin users and storefront customers.

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `EMAIL_PROVIDER` | `SMTP`, `SENDGRID`, or `DEV` (writes EML files to disk) | `DEV` |
| `EMAIL_FROM_DEFAULT` | Fallback sender address used when no category override exists | `no-reply@example.com` |
| `EMAIL_FROM_NAME_DEFAULT` | Fallback sender name | `Sistema Administrativo` |
| `EMAIL_SMTP_HOST` / `EMAIL_SMTP_PORT` / `EMAIL_SMTP_USER` / `EMAIL_SMTP_PASSWORD` | SMTP credentials (required when `EMAIL_PROVIDER=SMTP`) | – |
| `EMAIL_SMTP_SECURE` | Enables TLS/SSL for SMTP connections | `false` |
| `SENDGRID_API_KEY` | SendGrid API token (required when `EMAIL_PROVIDER=SENDGRID`) | – |
| `EMAIL_QUEUE_URL` | Redis connection string for BullMQ. Falls back to `QUEUE_REDIS_URL` or `REDIS_URL`. If none is provided, messages are dispatched inline. | – |
| `EMAIL_QUEUE_CONCURRENCY` | Number of concurrent workers that send emails | `4` |
| `EMAIL_MAX_RETRIES` | Maximum attempts before a message is marked as failed | `3` |
| `EMAIL_RETRY_DELAY_MS` | Base delay (ms) for exponential retry backoff | `30000` |
| `EMAIL_SEND_TIMEOUT_MS` | Provider send timeout when queueing is enabled | `60000` |
| `PASSWORD_RESET_TOKEN_TTL_MS` | Expiration time for password reset tokens | `3600000` (60 minutes) |
| `PASSWORD_RESET_WINDOW_MS` | Time window used for per-user request throttling | `900000` (15 minutes) |
| `PASSWORD_RESET_MAX_REQUESTS` | Maximum reset requests per user in the throttling window | `3` |
| `PASSWORD_RESET_MAX_REQUESTS_PER_IP` | Maximum reset requests per IP in the throttling window | `10` |
| `ADMIN_PASSWORD_RESET_URL` | Optional link template for admin reset emails. Use `{{token}}` placeholder. | – |
| `CUSTOMER_PASSWORD_RESET_URL` | Optional link template for storefront reset emails. | – |
| `CUSTOMER_PORTAL_URL` | Base URL for customer self-service links used inside templates. | – |

> **Tip:** When running locally without Redis, the queue falls back to inline delivery and the DEV transport writes `.eml` files to `tmp/email-previews/`.

## Admin Controls

1. Navigate to **Settings → Email**.
2. Use the tabs to configure senders and recipients for Orders, Payments, and Authentication emails.
3. Maintain routing rules that automatically notify admin roles (e.g., Finance for payments).
4. Trigger a test email for any category or locale.
5. Inspect the delivery log table to review recent attempts, provider message IDs, and error details.

## Templates & Localization

- Source templates live under `backend/src/email/templates`. Each template is written in MJML with Handlebars placeholders.
- Static definitions are synchronised into the database at boot, so changes deployed to the repository become active automatically.
- Localized subjects and content currently ship for English (`en`) and Spanish (`es`). Additional locales can be added by extending `TEMPLATE_DEFINITIONS` and the admin translations.

## Testing

- Unit test coverage lives in `backend/src/email/__tests__`. Run `npm run test -- workspace backend` to execute the suite.
- The frontend view uses React Testing Library conventions; run `npm run test` inside `frontend/` to validate UI behaviour (ensure mocks are updated to bypass the API when testing offline).

## Operations & Troubleshooting

- Failed messages remain in the delivery log with the provider error and the number of attempts.
- To replay a message, adjust the recipient settings and trigger a **Send test** from the admin UI, or re-run the originating workflow (order/payment/reset).
- When running in production, monitor the BullMQ queue via Redis metrics or a dashboard (e.g., Bull Board) for stuck jobs.
- Password reset requests are rate-limited per user and per IP. If throttling triggers unexpectedly, adjust the environment limits listed above.

