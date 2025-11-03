import { promises as fs } from "fs";
import path from "path";

type CacheEntry<T> = {
  value: T;
  storedAt: string;
};

const CACHE_ROOT = path.join(process.cwd(), ".cache", "storefront");

const inMemoryStore = new Map<string, CacheEntry<unknown>>();

const resolvePath = (key: string) => path.join(CACHE_ROOT, `${key}.json`);

export async function readJsonCache<T>(key: string): Promise<CacheEntry<T> | null> {
  if (inMemoryStore.has(key)) {
    return inMemoryStore.get(key) as CacheEntry<T>;
  }

  try {
    const filePath = resolvePath(key);
    const payload = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(payload) as CacheEntry<T>;
    inMemoryStore.set(key, parsed);
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[cache] Failed to read ${key} cache:`, error);
    }
    return null;
  }
}

export async function writeJsonCache<T>(key: string, value: T): Promise<void> {
  const entry: CacheEntry<T> = {
    value,
    storedAt: new Date().toISOString()
  };

  try {
    await fs.mkdir(CACHE_ROOT, { recursive: true });
    await fs.writeFile(resolvePath(key), JSON.stringify(entry), "utf8");
    inMemoryStore.set(key, entry);
  } catch (error) {
    console.warn(`[cache] Failed to persist ${key} cache:`, error);
  }
}
