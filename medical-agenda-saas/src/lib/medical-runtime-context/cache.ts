type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function getRuntimeCache<T>(key: string): T | null {
  try {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.value as T;
  } catch {
    return null;
  }
}

export function setRuntimeCache<T>(key: string, value: T, ttlSeconds: number): void {
  try {
    cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  } catch {
    // Cache must never affect doctor chat availability.
  }
}

export function clearRuntimeContextCacheForTests(): void {
  cache.clear();
}

