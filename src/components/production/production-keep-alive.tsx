'use client';

import { useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Keeps each visited Production tab mounted (hidden when inactive).
 * Tab switches do not remount pages → no duplicate API fetches.
 */
export function ProductionKeepAlive({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const cacheRef = useRef<Map<string, ReactNode>>(new Map());
  const [, force] = useState(0);

  // Only cache the first mount of each route — never replace (would remount & refetch)
  if (!cacheRef.current.has(pathname)) {
    cacheRef.current.set(pathname, children);
    // Ensure React commits the newly added pane
    queueMicrotask(() => force((n) => n + 1));
  }

  return (
    <>
      {[...cacheRef.current.entries()].map(([path, node]) => {
        const active = path === pathname;
        return (
          <div
            key={path}
            hidden={!active}
            style={active ? undefined : { display: 'none' }}
            aria-hidden={!active}
          >
            {node}
          </div>
        );
      })}
    </>
  );
}
