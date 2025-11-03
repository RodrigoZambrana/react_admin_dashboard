# Storefront Snapshot Resilience

This snapshot layer keeps the ecommerce storefront operational with real data while the backend APIs are degraded or offline.

## What gets captured

`POST /api/internal/snapshots`

* Storefront config (`StorefrontApi.getConfig`)
* Category tree (`StorefrontApi.listCategories`)
* Product collections
  * Featured (`sort=featured`)
  * Newest (`sort=newest`)
  * Best sellers (`sort=best-sellers`)
  * Top products for the first N categories (`sort=featured`, page size 16)

These datasets are written to `.cache/storefront/storefront-snapshot.json` (plus the existing `storefront-config` cache) and are reused whenever the live API cannot respond.

## Security

Set `SNAPSHOT_ACCESS_TOKEN` to require a header:

```
curl -XPOST /api/internal/snapshots \
  -H 'x-snapshot-token: ${SNAPSHOT_ACCESS_TOKEN}'
```

Without the token, the endpoint is unauthenticated (useful for local dev).

## Serving snapshot data

* Server-side callers (`StorefrontApi`) load the snapshot straight from disk with `readJsonCache`.
* Client-side panels reuse the same data via `GET /api/public/snapshots`, handled transparently by `loadStorefrontSnapshot()`.

When `StorefrontApi.listCategories` or `listProducts` hit an error, they automatically return the snapshot payload instead of throwing.

Panels that use `usePanelResource` can register a `snapshotSelector`. When the live request fails the hook swaps to the snapshot result, marks the data as stale, and surfaces the capture timestamp.

## Running the snapshot job

* Manual: `curl -XPOST /api/internal/snapshots`
* CI: Run the same request after deploy / on a cron.
* Admin tooling: wire a button to call the endpoint and show the stored timestamp (`GET /api/internal/snapshots`).

Snapshots should be refreshed whenever the catalog changes materially (imports, bulk updates) and at a regular cadence (hourly or daily) to ensure stale inventory doesn’t linger.

## Admin toggle

The administrative app exposes a toggle under *Settings → System configuration → Storefront cache fallback*. Flip it off to prevent the storefront from serving cached snapshots when the API is down; flip it on to re-enable the seamless fallback experience.

## Client indicators

When a panel is served from the snapshot:

* The panel stays populated, with an inline notice like `Mostrando datos guardados (capturado 08:30)`.
* Buttons still provide a retry path, but the page never degrades into a full-screen error.

This behaviour combined with the snapshot caches ensures the storefront remains navigable even during extended backend outages.***
