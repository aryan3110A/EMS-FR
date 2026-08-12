'use client';

import Link from 'next/link';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatNumber } from '@/lib/utils';

export default function WastagePage() {
  const { data: allRuns } = useCachedQuery('production:runs', () => api.production.runs(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const runs = (allRuns || []).filter((r: any) => r.hullingFinalizedAt && r.hullingWastagePct != null);
  const threshold = 12;
  const alerts = runs.filter((r: any) => r.wastageAlert || Number(r.hullingWastagePct) > threshold);

  return (
    <ProductionShell title="Wastage" subtitle={`Hulling wastage report (alert threshold ${threshold}%)`}>
      <div className="ems-card mb-4 p-4">
        <h3 className="mb-3 font-semibold text-rose-700">Alerts</h3>
        {!alerts.length ? (
          <p className="text-sm text-slate-400">No high-wastage runs</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {alerts.map((r: any) => (
              <li key={r.id} className="flex justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <Link href={`/production/runs/${r.id}`} className="font-medium text-blue-700 hover:underline">
                  {r.productionNumber}
                </Link>
                <span className="font-semibold text-rose-700">{r.hullingWastagePct}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ems-card p-4">
        <h3 className="mb-3 font-semibold">All finalized runs</h3>
        <table className="ems-table w-full text-sm">
          <thead>
            <tr>
              <th>Production</th>
              <th>Plant</th>
              <th>Product</th>
              <th>Input MT</th>
              <th>Net MT</th>
              <th>Wastage %</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r: any) => (
              <tr key={r.id} className={r.wastageAlert ? 'bg-rose-50' : ''}>
                <td>
                  <Link href={`/production/runs/${r.id}`} className="text-blue-600 hover:underline">
                    {r.productionNumber}
                  </Link>
                </td>
                <td>{r.plant?.name}</td>
                <td>{r.product?.name}</td>
                <td>{formatNumber(r.totalInputKg / 1000, 3)}</td>
                <td>{formatNumber(r.netOutputKg / 1000, 3)}</td>
                <td className={r.wastageAlert ? 'font-semibold text-rose-600' : ''}>{r.hullingWastagePct}%</td>
              </tr>
            ))}
            {!runs.length && (
              <tr>
                <td colSpan={6} className="text-slate-400">
                  No hulling-finalized runs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ProductionShell>
  );
}
