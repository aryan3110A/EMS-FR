'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type CacheEntry = { data: unknown; at: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function invalidateQueryCache(prefix?: string) {
  for (const key of [...cache.keys()]) {
    if (!prefix || key.startsWith(prefix)) cache.delete(key);
  }
}

function readCache<T>(key: string, ttl = DEFAULT_TTL_MS): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.at > ttl) return null;
  return entry.data as T;
}

function writeCache<T>(key: string, data: T) {
  cache.set(key, { data, at: Date.now() });
}

export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: number },
) {
  const ttl = options?.ttl ?? DEFAULT_TTL_MS;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | null>(() => readCache<T>(key, ttl));
  const [loading, setLoading] = useState(() => !readCache<T>(key, ttl));
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!force) {
        const cached = readCache<T>(key, ttl);
        if (cached !== null) {
          setData(cached);
          setLoading(false);
          return;
        }
      }

      if (inflight.has(key)) {
        try {
          const result = (await inflight.get(key)!) as T;
          setData(result);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e : new Error('Request failed'));
        } finally {
          setLoading(false);
        }
        return;
      }

      setLoading((prev) => prev || !readCache<T>(key, ttl));

      const promise = fetcherRef
        .current()
        .then((result) => {
          writeCache(key, result);
          inflight.delete(key);
          return result;
        })
        .catch((e) => {
          inflight.delete(key);
          throw e;
        });

      inflight.set(key, promise);

      try {
        const result = (await promise) as T;
        setData(result);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Request failed'));
      } finally {
        setLoading(false);
      }
    },
    [key, ttl],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refresh: () => load(true) };
}
