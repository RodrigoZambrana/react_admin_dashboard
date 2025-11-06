'use client';

const ORDER_LOCK_TTL_MS = 60 * 1000;

type OrderLockRecord = {
  completedAt: number;
};

const getSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const parseOrderLock = (raw: string | null): OrderLockRecord | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.completedAt === "number") {
      return { completedAt: parsed.completedAt };
    }
  } catch {
    if (raw === "completed") {
      return { completedAt: Date.now() };
    }
  }
  return null;
};

export const readOrderLock = (key: string): OrderLockRecord | null => {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }
  return parseOrderLock(storage.getItem(key));
};

export const writeOrderLock = (key: string): void => {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  const record: OrderLockRecord = { completedAt: Date.now() };
  storage.setItem(key, JSON.stringify(record));
};

export const clearOrderLock = (key: string): void => {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(key);
};

export const isOrderLockActive = (record: OrderLockRecord, now: number = Date.now()): boolean => {
  return now - record.completedAt < ORDER_LOCK_TTL_MS;
};

export const readActiveOrderLock = (key: string): OrderLockRecord | null => {
  const record = readOrderLock(key);
  if (!record) {
    return null;
  }
  if (isOrderLockActive(record)) {
    return record;
  }
  clearOrderLock(key);
  return null;
};

export const getOrderLockTtlMs = () => ORDER_LOCK_TTL_MS;
