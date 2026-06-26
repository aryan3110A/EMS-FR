'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutosave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  options?: { debounceMs?: number; enabled?: boolean },
) {
  const debounceMs = options?.debounceMs ?? 2000;
  const enabled = options?.enabled ?? true;
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(data);
  latest.current = data;
  const lastSavedKey = useRef('');
  const failedKey = useRef<string | null>(null);
  const dataKey = JSON.stringify(data);

  const isSaving = useRef(false);
  const pendingSave = useRef(false);

  const saveNow = useCallback(async () => {
    if (isSaving.current) {
      pendingSave.current = true;
      return;
    }
    const key = JSON.stringify(latest.current);
    if (key === lastSavedKey.current) {
      setStatus('saved');
      return;
    }
    setStatus('saving');
    isSaving.current = true;
    try {
      await saveFn(latest.current);
      lastSavedKey.current = key;
      failedKey.current = null;
      setStatus('saved');
    } catch {
      failedKey.current = key;
      setStatus('error');
    } finally {
      isSaving.current = false;
      if (pendingSave.current) {
        pendingSave.current = false;
        // Schedule a follow-up save after a tiny delay
        setTimeout(() => saveNow(), 50);
      }
    }
  }, [saveFn]);

  useEffect(() => {
    if (!enabled) {
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    if (dataKey === lastSavedKey.current) return;
    if (dataKey === failedKey.current) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveNow();
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dataKey, debounceMs, enabled, saveNow]);

  return { status, saveNow };
}

export function AutosaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === 'idle') return null;
  const text =
    status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save failed';
  const color =
    status === 'error' ? 'text-red-600' : status === 'saved' ? 'text-green-600' : 'text-slate-500';
  return <span className={`text-xs font-medium ${color}`}>{text}</span>;
}
