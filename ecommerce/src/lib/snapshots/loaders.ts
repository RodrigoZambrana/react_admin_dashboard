import type { StorefrontSnapshot, StorefrontSnapshotRecord } from "./types";

let inMemorySnapshot: StorefrontSnapshotRecord | null = null;
let snapshotUnavailable = false;

const SNAPSHOT_CACHE_KEY = "storefront-snapshot";

declare global {
  interface Window {
    __STORE_SNAPSHOT__?: {
      record?: StorefrontSnapshotRecord;
      missing?: boolean;
    };
  }
}

type ClientSnapshotResponse = {
  snapshot: StorefrontSnapshot;
  storedAt: string;
};

const markClientMissing = () => {
  if (typeof window !== "undefined") {
    window.__STORE_SNAPSHOT__ = {
      ...(window.__STORE_SNAPSHOT__ ?? {}),
      missing: true,
    };
  }
};

const setClientRecord = (record: StorefrontSnapshotRecord) => {
  if (typeof window !== "undefined") {
    window.__STORE_SNAPSHOT__ = {
      record,
      missing: false,
    };
  }
};

const fetchClientSnapshot = async (): Promise<ClientSnapshotResponse | null | "missing"> => {
  try {
    const response = await fetch("/api/public/snapshots", { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 404) {
        return "missing";
      }
      return null;
    }
    const payload = (await response.json()) as ClientSnapshotResponse;
    return payload;
  } catch (error) {
    console.warn("[snapshot] Unable to load client snapshot payload:", error);
    return null;
  }
};

export const loadStorefrontSnapshot = async (): Promise<StorefrontSnapshotRecord | null> => {
  if (inMemorySnapshot) {
    return inMemorySnapshot;
  }

  if (typeof window !== "undefined") {
    const clientState = window.__STORE_SNAPSHOT__;
    if (clientState?.record) {
      inMemorySnapshot = clientState.record;
      return clientState.record;
    }
    if (clientState?.missing) {
      return null;
    }
  }

  if (snapshotUnavailable) {
    return null;
  }

  if (typeof window === "undefined") {
    const { readJsonCache } = await import("@/lib/persistent-cache");
    const record = await readJsonCache<StorefrontSnapshot>(SNAPSHOT_CACHE_KEY);
    if (record) {
      inMemorySnapshot = record;
      setClientRecord(record);
    } else {
      snapshotUnavailable = true;
    }
    return record;
  }

  const payload = await fetchClientSnapshot();
  if (payload === "missing") {
    snapshotUnavailable = true;
    markClientMissing();
    return null;
  }
  if (!payload) {
    return null;
  }
  inMemorySnapshot = { value: payload.snapshot, storedAt: payload.storedAt };
  setClientRecord(inMemorySnapshot);
  return inMemorySnapshot;
};

export const clearSnapshotCache = () => {
  inMemorySnapshot = null;
  snapshotUnavailable = false;
  if (typeof window !== "undefined") {
    delete window.__STORE_SNAPSHOT__;
  }
};

export {};
