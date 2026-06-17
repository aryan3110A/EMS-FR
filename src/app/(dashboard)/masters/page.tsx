'use client';

import { AppShell } from '@/components/layout/sidebar';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';

export default function MastersPage() {
  const { data: salespersons } = useCachedQuery('masters:salespersons', () => api.masters.salespersons());
  const { data: buyers } = useCachedQuery('masters:buyers', () => api.masters.buyers());
  const { data: products } = useCachedQuery('masters:products', () => api.masters.products());

  return (
    <AppShell title="Master Data">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="ems-card p-5">
          <h3 className="mb-3 font-semibold">Salespersons (phone orders only)</h3>
          <ul className="space-y-2 text-sm">
            {(salespersons ?? []).map((s) => (
              <li key={s.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{s.name}</span>
                <span className="text-slate-400">{s.code}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="ems-card p-5">
          <h3 className="mb-3 font-semibold">Buyers</h3>
          <ul className="space-y-2 text-sm max-h-80 overflow-y-auto">
            {(buyers ?? []).map((b) => (
              <li key={b.id} className="rounded-lg bg-slate-50 px-3 py-2">{b.name}</li>
            ))}
          </ul>
        </div>
        <div className="ems-card p-5">
          <h3 className="mb-3 font-semibold">Products</h3>
          <ul className="space-y-2 text-sm">
            {(products ?? []).map((p) => (
              <li key={p.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium">{p.code}</span> — {p.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
