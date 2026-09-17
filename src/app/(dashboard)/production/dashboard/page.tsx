'use client';

import Link from 'next/link';
import { ProductionShell } from '@/components/production/production-shell';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatNumber } from '@/lib/utils';

export default function ProductionDashboardPage() {
  const { data, loading, refresh } = useCachedQuery(
    'production:dashboard',
    () => api.production.dashboard(),
    { ttl: 15 * 60 * 1000 },
  );

  return (
    <ProductionShell title="Production Dashboard" subtitle="Owner / production overview">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Cached while you stay in Production — use Refresh only when you need latest numbers</p>
        <button
          type="button"
          className="ems-btn-secondary text-xs"
          onClick={() => refresh()}
          disabled={loading && !!data}
        >
          {loading && data ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {loading && !data ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Raw Material (KG)', data?.inventory?.totalRaw],
              ['Processed (KG)', data?.inventory?.totalProcessed],
              ['WIP (KG)', data?.inventory?.totalWip],
              ['Wastage Inv (KG)', data?.inventory?.totalWastageInventory],
              ['Sample Rejected (KG)', data?.inventory?.totalRejected],
            ].map(([label, value]) => (
              <div key={String(label)} className="ems-card p-4">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-800">{formatNumber(Number(value || 0), 0)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              ['Active Job Works', data?.jobWork?.activeJobWorks, '/production/job-work'],
              ['Material with JW (KG)', data?.jobWork?.materialWithJobWorkersKg, '/production/job-work'],
              ['JW Processed MTD (KG)', data?.jobWork?.jobWorkProcessedThisMonthKg, '/production/job-work'],
              [
                'JW Received MTD (KG)',
                data?.jobWork?.jobWorkMaterialReceivedKg ?? data?.jobWork?.jobWorkProcessedThisMonthKg,
                '/production/job-work',
              ],
              ['JW Pending Return (KG)', data?.jobWork?.jobWorkPendingReturnKg, '/production/job-work'],
              ['Sampling required', data?.samplingRequiredCount, '/production/sampling'],
            ].map(([label, value, href]) => (
              <Link key={String(label)} href={String(href)} className="ems-card block p-4 hover:border-blue-300">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-800">{formatNumber(Number(value || 0), 0)}</p>
              </Link>
            ))}
          </div>

          {(data?.productionSourceThisMonth || []).length > 0 && (
            <div className="ems-card mt-4 p-4">
              <h3 className="mb-2 font-semibold">Production source this month (KG)</h3>
              <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {(data.productionSourceThisMonth || []).map((s: any) => (
                  <li key={s.source} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>{String(s.source || '').replace(/_/g, ' ')}</span>
                    <span className="font-medium">{formatNumber(s.quantityKg, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="ems-card p-4">
              <h3 className="mb-3 font-semibold">Pending contracts</h3>
              <p className="text-sm text-slate-600">
                Overdue: <span className="font-semibold text-red-600">{data?.pendingContracts?.overdue ?? 0}</span>
                {' · '}Due ≤7 days: <span className="font-semibold text-amber-600">{data?.pendingContracts?.dueSoon ?? 0}</span>
                {' · '}Other: {data?.pendingContracts?.other ?? 0}
              </p>
              <Link href="/production/pending" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                View pending contracts →
              </Link>
            </div>
            <div className="ems-card p-4">
              <h3 className="mb-3 font-semibold">Production today</h3>
              <p className="text-sm text-slate-600">Active runs: {data?.production?.activeRuns ?? 0}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {(data?.production?.completedToday || []).map((r: any) => (
                  <li key={r.productionNumber}>
                    {r.productionNumber}: {r.product} · {formatNumber(r.netOutputKg, 0)} KG @ {r.plant}
                  </li>
                ))}
                {!data?.production?.completedToday?.length && <li className="text-slate-400">No runs completed today</li>}
              </ul>
            </div>
          </div>

          <div className="mt-4 ems-card p-4">
            <h3 className="mb-3 font-semibold text-rose-700">Wastage alerts (&gt; threshold)</h3>
            {(data?.wastageAlerts || []).length === 0 ? (
              <p className="text-sm text-slate-400">No alerts</p>
            ) : (
              <table className="ems-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Production</th>
                    <th>Plant</th>
                    <th>Product</th>
                    <th>Input kg</th>
                    <th>Wastage %</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {data.wastageAlerts.map((r: any) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/production/runs/${r.id}`} className="text-blue-600 hover:underline">
                          {r.productionNumber}
                        </Link>
                      </td>
                      <td>{r.plant?.name}</td>
                      <td>{r.product?.name}</td>
                      <td>{formatNumber(r.totalInputKg, 0)}</td>
                      <td className="font-semibold text-rose-600">{r.hullingWastagePct}%</td>
                      <td>{r.createdBy?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="ems-card p-4">
              <h3 className="mb-3 font-semibold">Inventory by location</h3>
              <ul className="space-y-1 text-sm">
                {Object.entries(data?.inventory?.byLocation || {}).map(([name, kg]) => (
                  <li key={name} className="flex justify-between">
                    <span>{name}</span>
                    <span className="font-medium">{formatNumber(Number(kg), 0)} KG</span>
                  </li>
                ))}
                {!Object.keys(data?.inventory?.byLocation || {}).length && (
                  <li className="text-slate-400">No stock</li>
                )}
              </ul>
            </div>
            <div className="ems-card p-4">
              <h3 className="mb-3 font-semibold">Sampling / transfers</h3>
              <p className="text-sm text-slate-600">Sampling:</p>
              <ul className="mb-2 space-y-1 text-sm">
                {(data?.sampling || []).map((s: any) => (
                  <li key={s.status}>
                    {String(s.status).replace(/_/g, ' ')}: {s.count}
                  </li>
                ))}
                {!data?.sampling?.length && <li className="text-slate-400">None</li>}
              </ul>
              <p className="text-sm text-slate-600">Transfers:</p>
              <ul className="space-y-1 text-sm">
                {(data?.transfers || []).map((t: any) => (
                  <li key={t.status}>
                    {String(t.status).replace(/_/g, ' ')}: {t.count}
                  </li>
                ))}
                {!data?.transfers?.length && <li className="text-slate-400">None</li>}
              </ul>
            </div>
            <div className="ems-card p-4">
              <h3 className="mb-3 font-semibold">Pending payments</h3>
              <p className="text-sm text-slate-600">
                Containers with balance: <strong>{data?.payments?.pendingContainers ?? 0}</strong>
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Overdue remaining amt: <strong>{formatNumber(data?.payments?.overdueAmount ?? 0, 0)}</strong>
              </p>
            </div>
          </div>
        </>
      )}
    </ProductionShell>
  );
}
