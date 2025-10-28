# Unified Notification Infrastructure

This document summarizes the new notification pipeline that powers real-time alerts across the admin dashboard and the storefront.

## Overview

Notifications are now generated from core commerce events (orders, payments, and order status transitions) and dispatched through configurable channels:

- **In-app**: persisted in the database and delivered over Server-Sent Events (SSE) to both admin users and storefront customers.
- **Email**: continues to leverage the existing Email module, but is orchestrated together with in-app delivery and synced with the new settings.
- **Push**: scaffolding is in place for future Web Push support.

Key backend components:

- Extended Prisma schema with `Notification`, `NotificationSetting`, and supporting enums.
- `NotificationOrchestratorService` to translate domain events into targeted notification records.
- `NotificationQueueService` (BullMQ) to guarantee in-app delivery with retry semantics.
- REST + SSE endpoints for both admin (`/notifications`) and storefront (`/storefront/account/notifications`).
- Admin and storefront controllers expose list, unread-count, and mark-as-read operations.

## Prisma changes

A new migration ( `20260617123000_notification_infrastructure` ) introduces the notification tables and enums. Apply it alongside the rest of the Prisma migrations:

```bash
cd backend
npx prisma migrate deploy
```

Generate the updated client after applying migrations:

```bash
npx prisma generate
```

## Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `NOTIFS_QUEUE_PROVIDER` | `memory` (inline) or `redis` | `memory`
| `NOTIFS_QUEUE_URL` | Redis connection string for notification jobs | – |
| `NOTIFS_QUEUE_ATTEMPTS` | Max retry attempts per job | `3`
| `NOTIFS_QUEUE_RETRY_DELAY_MS` | Backoff delay between retries | `15000`

The service also reuses shared queue fallbacks (`QUEUE_REDIS_URL`, `REDIS_URL`) when specific notification variables are not set.

## Backend endpoints

### Admin (JWT protected)

- `GET /notifications` – paginated list (`page`, `pageSize`, `eventType`, `channel`, `unreadOnly`, `since`).
- `GET /notifications/unread-count` – unread total for the current user.
- `POST /notifications/read` – body `{ ids?: number[]; markAll?: boolean }`.
- `SSE /notifications/events` – real-time delivery.
- `GET /notification-settings` – returns all channel settings.
- `PUT /notification-settings` – accepts `{ settings: NotificationSettingUpdateInput[] }`.

### Storefront (JWT/cookie protected)

- `GET /storefront/account/notifications`
- `GET /storefront/account/notifications/unread-count`
- `POST /storefront/account/notifications/read`
- `SSE /storefront/account/notifications/events`

## Admin UI updates

- The top-bar bell now consumes the Redux-driven notification store, automatically refreshing via SSE when new events arrive.
- A new `notifications` slice tracks items, unread counts, and settings state.
- `Account → Settings → Notification` was redesigned to configure in-app/email per audience and per event, with role routing for admin alerts.

## Storefront UI updates

- A notification bell now appears in the desktop header. Logged-in customers see a live feed (SSE), can mark items read, and monitor order/payment updates without page reloads.
- Supporting API helpers were added to `StorefrontApi` with new types in `types/storefront.ts`.

## Event mapping

| Event | Customer (default) | Admin (default roles) |
| --- | --- | --- |
| `ORDER_RECEIVED` | In-app + Email | In-app + Email (`ADMIN`, `OPS`, `SALES`)
| `PAYMENT_RECEIVED` | In-app + Email | In-app + Email (`ADMIN`, `FINANCE`)
| `ORDER_STATUS_CHANGED` | In-app | In-app (`ADMIN`, `OPS`, `SALES`)

Email delivery continues to use the existing templates and role-routing rules, now synchronized when notification settings change.

## Testing checklist

### Backend

1. Apply migrations and regenerate Prisma client.
2. Run `npm run lint` (tsc) in `backend` to ensure type safety.
3. Trigger domain events:
   - Create an order ➜ verify `notifyOrderReceived` logs and SSE payload.
   - Confirm a payment ➜ check notifications + email queue.
   - Change order status ➜ confirm status notifications.
4. Hit the REST endpoints to ensure filtering and pagination behave as expected.

### Admin frontend

1. Start the dev server and sign in.
2. Wait for SSE connection (badge should update on new events).
3. Open the drawer, filter, and mark items read (single & all).
4. Modify settings and ensure toggles persist (network tab shows `PUT /notification-settings`).

_Note_: `npm run lint` currently reports legacy parsing warnings from unchanged modules (`Sales/OrderNew`). New code passes type-checking.

### Storefront

1. Start the storefront app and sign in as a customer.
2. Observe the notification badge after creating orders/payments.
3. Open the menu to confirm items stream in real-time; mark items read.

Since `next lint` prompts for interactive configuration in this repository, linting was not executed for the storefront package.

## Deployment notes

- Ensure the notification queue environment variables are set (prefer Redis in production).
- Open SSE endpoints on the reverse-proxy (keep-alive connections, correct timeouts).
- If using cookies for storefront auth, keep the `storefront_access_token` cookie in scope for SSE requests.

