const DEFAULT_TTL_MS = 2 * 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const globalCache = globalThis as typeof globalThis & {
  __iftsMemoryCache?: Map<string, CacheEntry<unknown>>;
};

const memoryCache = globalCache.__iftsMemoryCache ?? new Map<string, CacheEntry<unknown>>();
globalCache.__iftsMemoryCache = memoryCache;

export async function getCached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
  bypass = false
): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;

  if (!bypass && cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value;
  }

  if (!bypass && cached?.promise && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = loader()
    .then((value) => {
      memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      return value;
    })
    .catch((error) => {
      memoryCache.delete(key);
      throw error;
    });

  memoryCache.set(key, {
    promise,
    expiresAt: now + ttlMs,
  });

  return promise;
}

export function cacheHeaders(ttlMs = DEFAULT_TTL_MS): HeadersInit {
  const maxAge = Math.max(1, Math.floor(ttlMs / 1000));

  return {
    "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    "X-Cache-TTL": String(maxAge),
  };
}
