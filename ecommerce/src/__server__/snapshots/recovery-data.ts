/**
 * Recovery snapshots provide production-safe fallback data when the primary APIs are unavailable.
 * Populate these structures with real datasets exported from the backend (for example via a manual
 * snapshot job) and activate recovery mode by setting `NEXT_PUBLIC_RECOVERY_MODE=snapshot`.
 *
 * When no snapshot is present the application falls back to either local mock data (in local envs)
 * or fails fast to surface the outage in higher environments.
 */

import type Shop from "@/models/shop.model";
import { cardList, salesData, topCountryList } from "@/__server__/__db__/dashboard/data";

type SummaryCard = (typeof cardList)[number];
type CountrySale = (typeof topCountryList)[number];
type SalesDataset = typeof salesData;

export interface VendorDashboardRecoveryDataset {
  sales?: SalesDataset;
  summaryCards?: SummaryCard[];
  countrySales?: CountrySale[];
}

/**
 * Replace the `null` value with real data captured from the production APIs whenever you want to
 * serve a trusted snapshot (e.g. during an outage). Keep the shape aligned with the types above.
 */
export const vendorDashboardRecovery: VendorDashboardRecoveryDataset | null = null;

/**
 * Provide a production snapshot of the shops collection here (or leave null when no recovery data
 * is available). Each entry must respect the Shop model contract.
 */
export const shopsRecoverySnapshot: Shop[] | null = null;
