'use client';

import { AppShell } from '@/components/layout/sidebar';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatNumber } from '@/lib/utils';

export default function ReportsPage() {
  const { data, loading } = useCachedQuery('reports:production-dashboard', () => api.production.dashboard(), {
    ttl: 5 * 60 * 1000,
  });

  const inv = data?.inventory || {};
  const sources = data?.productionSourceThisMonth || [];

  return (
    <AppShell title="Reports" subtitle="Production quantities in KG">
      <div className="ems-card mb-4 p-4">
        <h2 className="text-lg font-semibold text-slate-800">Production inventory (KG)</h2>
        <p className="mt-1 text-xs text-slate-500">Same available-processed formula as Fulfilment (lot available KG)</p>
        {loading && !data ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Raw Material', inv.totalRaw],
              ['Processed (available)', inv.processedAvailableForFulfilment ?? inv.totalProcessed],
              ['Wastage Inventory', inv.totalWastageInventory],
              ['Sampling-Rejected', inv.totalRejected],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-semibold tabular-nums">{formatNumber(Number(value || 0), 0)} KG</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ems-card mb-4 p-4">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Production source this month (KG)</h2>
        {sources.length ? (
          <ul className="space-y-1 text-sm">
            {sources.map((s: any) => (
              <li key={s.source} className="flex justify-between border-b border-slate-50 py-1">
                <span>{String(s.source || '').replace(/_/g, ' ')}</span>
                <span className="font-medium tabular-nums">{formatNumber(s.quantityKg, 0)} KG</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No production lots this month</p>
        )}
      </div>

      <div className="ems-card p-4">
        <h2 className="text-lg font-semibold text-slate-800">Month-Wise Order List PDF</h2>
        <p className="mt-2 text-sm text-slate-500">
          Contract commercial PDF export remains Phase 2. Production-domain reports above default to KG.
        </p>
      </div>
    </AppShell>
  );
}
