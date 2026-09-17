'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/production/dashboard', label: 'Dashboard' },
  { href: '/production/inward', label: 'Inward' },
  { href: '/production/pending', label: 'Pending' },
  { href: '/production/runs', label: 'Runs' },
  { href: '/production/job-work', label: 'Job Work' },
  { href: '/production/fulfilment', label: 'Fulfilment' },
  { href: '/production/sampling', label: 'Sampling' },
  { href: '/production/inventory', label: 'Inventory' },
  { href: '/production/wastage', label: 'Wastage' },
  { href: '/production/transfers', label: 'Transfers' },
  { href: '/production/audit', label: 'Audit' },
];

type PageMeta = {
  setTitle: (title: string) => void;
  setSubtitle: (subtitle?: string) => void;
};

const ProductionPageContext = createContext<PageMeta | null>(null);

export function ProductionChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [title, setTitle] = useState('Production');
  const [subtitle, setSubtitle] = useState<string | undefined>('Production module');

  const value = useMemo(
    () => ({
      setTitle,
      setSubtitle: (s?: string) => setSubtitle(s),
    }),
    [],
  );

  return (
    <ProductionPageContext.Provider value={value}>
      <AppShell title={title} subtitle={subtitle}>
        <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 pb-2">
          {TABS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
            return (
              <Link
                key={t.href}
                href={t.href}
                prefetch
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        {children}
      </AppShell>
    </ProductionPageContext.Provider>
  );
}

/** Sets page title without remounting AppShell / NotificationBell on tab change. */
export function ProductionShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(ProductionPageContext);
  const setTitle = ctx?.setTitle;
  const setSubtitle = ctx?.setSubtitle;

  useEffect(() => {
    setTitle?.(title);
    setSubtitle?.(subtitle);
  }, [title, subtitle, setTitle, setSubtitle]);

  // Fallback if used outside chrome (shouldn't happen)
  if (!ctx) {
    return <AppShell title={title} subtitle={subtitle}>{children}</AppShell>;
  }

  return <>{children}</>;
}

export function useProductionPageMeta() {
  return useContext(ProductionPageContext);
}

/** Shared TTL for production list screens (5 minutes). */
export const PRODUCTION_CACHE_TTL = 5 * 60 * 1000;

export function productionCacheKey(parts: (string | number | undefined | null)[]) {
  return ['production', ...parts.map((p) => String(p ?? ''))].join(':');
}
