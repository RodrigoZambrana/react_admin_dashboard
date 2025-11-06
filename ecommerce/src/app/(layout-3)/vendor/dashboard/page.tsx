import { Fragment } from "react";
import { IconDeviceAnalytics } from "@tabler/icons-react";
// API FUNCTIONS
import api from "@utils/__api__/dashboard";
// GLOBAL CUSTOM COMPONENTS
import DashboardPageHeader from "@component/DashboardPageHeader";
// PAGE SECTION COMPONENTS
import DashboardContent from "@sections/vendor-dashboard/dashboard";
import { cardList, salesData, topCountryList } from "@/__server__/__db__/dashboard/data";
import { vendorDashboardRecovery } from "@/__server__/snapshots/recovery-data";

type SalesDataset = typeof salesData;
type SummaryCard = (typeof cardList)[number];
type CountrySale = (typeof topCountryList)[number];

const RUNTIME_ENV = process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV ?? "development";
const IS_LOCAL_ENV = RUNTIME_ENV === "local" || RUNTIME_ENV === "development";
const RECOVERY_MODE_ENABLED = process.env.NEXT_PUBLIC_RECOVERY_MODE === "snapshot";
const ENFORCE_FAIL_FAST = process.env.NEXT_PUBLIC_VENDOR_FAIL_FAST === "true";

const EMPTY_SALES_DATA: SalesDataset = { labels: [], data: [] };
const EMPTY_SUMMARY_CARDS: SummaryCard[] = [];
const EMPTY_COUNTRY_SALES: CountrySale[] = [];

async function fetchWithFallback<T>(
  fetcher: () => Promise<T>,
  label: string,
  options: {
    localFallback: T;
    recoverySnapshot: T | null | undefined;
    emptyFallback: T;
  }
) {
  try {
    return await fetcher();
  } catch (error) {
    console.warn(`[vendor-dashboard] Failed to load ${label}.`);
    console.debug(error);

    if (RECOVERY_MODE_ENABLED) {
      if (options.recoverySnapshot) {
        console.warn(`[vendor-dashboard] Using recovery snapshot for ${label}.`);
        return options.recoverySnapshot;
      }

      console.warn(
        `[vendor-dashboard] Recovery mode is enabled but no snapshot was provided for ${label}. Returning empty dataset.`
      );
      return options.emptyFallback;
    }

    if (!IS_LOCAL_ENV) {
      if (ENFORCE_FAIL_FAST) {
        console.error(
          `[vendor-dashboard] No recovery data available for ${label}. Failing fast because NEXT_PUBLIC_VENDOR_FAIL_FAST=true.`
        );
        throw error;
      }

      console.error(
        `[vendor-dashboard] No recovery data available for ${label}. Returning empty dataset to avoid exposing mock data.`
      );
      return options.emptyFallback;
    }

    console.warn(
      `[vendor-dashboard] Using local mock fallback for ${label} (NEXT_PUBLIC_ENV=${RUNTIME_ENV}).`
    );
    return options.localFallback;
  }
}

export default async function VendorDashboard() {
  const [sales, summeryCards, countrySales] = await Promise.all([
    fetchWithFallback(() => api.getSales(), "sales metrics", {
      localFallback: salesData,
      recoverySnapshot: vendorDashboardRecovery?.sales,
      emptyFallback: EMPTY_SALES_DATA
    }),
    fetchWithFallback(() => api.getSummeryCards(), "summary cards", {
      localFallback: cardList,
      recoverySnapshot: vendorDashboardRecovery?.summaryCards,
      emptyFallback: EMPTY_SUMMARY_CARDS
    }),
    fetchWithFallback(() => api.getCountryBasedSales(), "country sales", {
      localFallback: topCountryList,
      recoverySnapshot: vendorDashboardRecovery?.countrySales,
      emptyFallback: EMPTY_COUNTRY_SALES
    })
  ]);

  return (
    <Fragment>
      <DashboardPageHeader title="Dashboard" Icon={<IconDeviceAnalytics size={24} />} />
      <DashboardContent sales={sales} summeryCards={summeryCards} countrySales={countrySales} />
    </Fragment>
  );
}
