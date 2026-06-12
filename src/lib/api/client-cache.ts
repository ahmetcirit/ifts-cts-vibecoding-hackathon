"use client";

const DEFAULT_TTL_MS = 2 * 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

export async function fetchCachedJson<T>(url: string, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(url) as CacheEntry<T> | undefined;

  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value;
  }

  if (cached?.promise && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetch(url)
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `Request failed: ${url}`);
      }
      memoryCache.set(url, {
        value: data,
        expiresAt: Date.now() + ttlMs,
      });
      return data as T;
    })
    .catch((error) => {
      memoryCache.delete(url);
      throw error;
    });

  memoryCache.set(url, {
    promise,
    expiresAt: now + ttlMs,
  });

  return promise;
}

export function invalidateClientCache(prefix?: string) {
  for (const key of memoryCache.keys()) {
    if (!prefix || key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}
