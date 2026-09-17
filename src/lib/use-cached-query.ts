'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type CacheEntry = { data: unknown; at: number };

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const STORAGE_PREFIX = 'ems_qcache:';

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

function readStorage<T>(key: string, ttl: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry || Date.now() - entry.at > ttl) {
      sessionStorage.removeItem(storageKey(key));
      return null;
    }
    memory.set(key, entry);
    return entry.data as T;
  } catch {
    return null;
  }
}

function writeStorage(key: string, data: unknown) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify({ data, at: Date.now() }));
  } catch {
    // quota / private mode — memory cache still works
  }
}

export function invalidateQueryCache(prefix?: string) {
  for (const key of [...memory.keys()]) {
    if (!prefix || key.startsWith(prefix)) memory.delete(key);
  }
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k?.startsWith(STORAGE_PREFIX)) continue;
      const logical = k.slice(STORAGE_PREFIX.length);
      if (!prefix || logical.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

function readCache<T>(key: string, ttl = DEFAULT_TTL_MS): T | null {
  const entry = memory.get(key);
  if (entry && Date.now() - entry.at <= ttl) return entry.data as T;
  return readStorage<T>(key, ttl);
}

function writeCache<T>(key: string, data: T) {
  const entry = { data, at: Date.now() };
  memory.set(key, entry);
  writeStorage(key, data);
}

export function peekQueryCache<T>(key: string, ttl = DEFAULT_TTL_MS): T | null {
  return readCache<T>(key, ttl);
}

export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: number; enabled?: boolean },
) {
  const ttl = options?.ttl ?? DEFAULT_TTL_MS;
  const enabled = options?.enabled ?? true;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(() => enabled);
  const [error, setError] = useState<Error | null>(null);
  const keyRef = useRef(key);

  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    const cached = readCache<T>(key, ttl);
    if (cached !== null) {
      setData(cached);
      setLoading(false);
    } else if (enabled) {
      setData(null);
      setLoading(true);
    }
  }, [key, ttl, enabled]);

  const load = useCallback(
    async (force = false) => {
      if (!enabled) {
        setLoading(false);
        return;
      }

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

      // Only show loading spinner when we have nothing to display
      setLoading((prev) => prev || readCache<T>(key, ttl) === null);

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
    [key, ttl, enabled],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refresh: () => load(true) };
}
