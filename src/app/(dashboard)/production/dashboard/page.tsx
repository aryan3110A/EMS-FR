'use client';

import Link from 'next/link';
import { ProductionShell } from '@/components/production/production-shell';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';
import { DueDateBadge } from '@/components/contracts/contract-register';

export default function ProductionDashboardPage() {
  const { data, loading, refresh } = useCachedQuery(
    'production:dashboard',
    () => api.production.dashboard(),
    { ttl: 15 * 60 * 1000 },
  );

  const totalPendingContracts =
    (data?.pendingContracts?.overdue || 0) +
    (data?.pendingContracts?.dueSoon || 0) +
    (data?.pendingContracts?.other || 0);

  return (
    <ProductionShell title="Production Dashboard" subtitle="Executive overview · Production KPIs · Inventory aging">
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
          {/* Top KPIs (§18.2) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="ems-card border-l-4 border-l-blue-600 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Material in Production</p>
              <p className="mt-2 text-2xl font-bold text-blue-900">
                {formatNumber(Number(data?.materialInProductionKg ?? data?.inventory?.totalWip ?? 0), 0)}{' '}
                <span className="text-xs font-normal text-slate-500">KG</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">Active WIP material across plants</p>
            </div>

            <div className="ems-card border-l-4 border-l-emerald-600 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Processed Inventory</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">
                {formatNumber(Number(data?.inventory?.totalProcessed || 0), 0)}{' '}
                <span className="text-xs font-normal text-slate-500">KG</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">Available good stock in warehouses</p>
            </div>

            <div className="ems-card border-l-4 border-l-purple-600 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Contracts</p>
              <p className="mt-2 text-2xl font-bold text-purple-900">
                {totalPendingContracts}{' '}
                <span className="text-xs font-normal text-slate-500">contracts</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {data?.pendingContracts?.overdue || 0} overdue · {data?.pendingContracts?.dueSoon || 0} due soon
              </p>
            </div>

            <div className="ems-card border-l-4 border-l-slate-600 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Raw Material</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {formatNumber(Number(data?.inventory?.totalRaw || 0), 0)}{' '}
                <span className="text-xs font-normal text-slate-500">KG</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">Unprocessed seed inventory</p>
            </div>

            <div className="ems-card border-l-4 border-l-amber-600 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Wastage Inventory</p>
              <p className="mt-2 text-2xl font-bold text-amber-900">
                {formatNumber(Number(data?.inventory?.totalWastageInventory || 0), 0)}{' '}
                <span className="text-xs font-normal text-slate-500">KG</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">Stored for Sortex or outward</p>
            </div>
          </div>

          {/* Aging Tables Section (§18.3) */}
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* 1. Unassigned Processed Stock Aging */}
            <div className="ems-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">Unassigned Processed Stock Aging</h3>
                  <p className="text-xs text-slate-500">Available processed lots waiting to be allocated to contracts.</p>
                </div>
                <Link href="/production/fulfilment" className="text-xs font-medium text-blue-600 hover:underline">
                  Fulfilment →
                </Link>
              </div>

              {(!data?.unassignedProcessedAging || data.unassignedProcessedAging.length === 0) ? (
                <p className="py-6 text-center text-xs text-slate-400">No unassigned processed lots in inventory.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left text-slate-500">
                        <th className="py-2 px-2">Lot</th>
                        <th className="py-2 px-2">Product</th>
                        <th className="py-2 px-2">Plant</th>
                        <th className="py-2 px-2 text-right">Available (KG)</th>
                        <th className="py-2 px-2 text-right">Aging</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.unassignedProcessedAging.map((lot: any) => {
                        const days = Number(lot.daysInStock || 0);
                        const badgeColor =
                          days > 60
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : days > 30
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200';
                        return (
                          <tr key={lot.lotNumber} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-1.5 px-2 font-mono font-medium text-slate-800">{lot.lotNumber}</td>
                            <td className="py-1.5 px-2">{lot.product}</td>
                            <td className="py-1.5 px-2 text-slate-600">{lot.plant}</td>
                            <td className="py-1.5 px-2 text-right font-semibold text-slate-900">
                              {formatNumber(lot.availableKg, 0)}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeColor}`}>
                                {days} {days === 1 ? 'day' : 'days'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. Allocated Undispatched Container Aging */}
            <div className="ems-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">Allocated Undispatched Container Aging</h3>
                  <p className="text-xs text-slate-500">Containers holding allocated stock awaiting final dispatch.</p>
                </div>
                <Link href="/production/pending" className="text-xs font-medium text-blue-600 hover:underline">
                  Pending →
                </Link>
              </div>

              {(!data?.allocatedUndispatchedAging || data.allocatedUndispatchedAging.length === 0) ? (
                <p className="py-6 text-center text-xs text-slate-400">No allocated undispatched containers currently.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left text-slate-500">
                        <th className="py-2 px-2">Contract</th>
                        <th className="py-2 px-2">Buyer</th>
                        <th className="py-2 px-2">Container</th>
                        <th className="py-2 px-2 text-right">Allocated</th>
                        <th className="py-2 px-2">Due Date</th>
                        <th className="py-2 px-2 text-right">Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.allocatedUndispatchedAging.map((c: any) => {
                        const days = Number(c.daysAllocated || 0);
                        const badgeColor =
                          days > 30
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : days > 14
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200';
                        return (
                          <tr key={`${c.contractNumber}-${c.containerIndex}`} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-1.5 px-2 font-semibold text-blue-600">{c.contractNumber}</td>
                            <td className="py-1.5 px-2 truncate max-w-[100px]">{c.buyer}</td>
                            <td className="py-1.5 px-2 font-medium">C#{c.containerIndex}</td>
                            <td className="py-1.5 px-2 text-right font-semibold text-slate-900">
                              {formatNumber(c.allocatedKg, 0)} KG
                            </td>
                            <td className="py-1.5 px-2">
                              <DueDateBadge dateStr={c.expectedShipmentDate} />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeColor}`}>
                                {days}d
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Operational summary */}
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="ems-card p-4">
              <h3 className="mb-3 font-semibold text-slate-800">Pending Contracts Status</h3>
              <p className="text-sm text-slate-600">
                Overdue: <span className="font-semibold text-red-600">{data?.pendingContracts?.overdue ?? 0}</span>
                {' · '}Due ≤7 days: <span className="font-semibold text-amber-600">{data?.pendingContracts?.dueSoon ?? 0}</span>
                {' · '}Other: {data?.pendingContracts?.other ?? 0}
              </p>
              <Link href="/production/pending" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
                View all pending contracts →
              </Link>
            </div>

            <div className="ems-card p-4">
              <h3 className="mb-3 font-semibold text-slate-800">Production Activity Today</h3>
              <p className="text-sm text-slate-600">Active runs in progress: {data?.production?.activeRuns ?? 0}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {(data?.production?.completedToday || []).map((r: any) => (
                  <li key={r.productionNumber} className="flex justify-between border-b border-slate-100 py-1">
                    <span className="font-medium">{r.productionNumber} · {r.product}</span>
                    <span className="font-semibold text-emerald-700">{formatNumber(r.netOutputKg, 0)} KG @ {r.plant}</span>
                  </li>
                ))}
                {!data?.production?.completedToday?.length && (
                  <li className="py-2 text-slate-400 text-xs">No runs completed today yet</li>
                )}
              </ul>
            </div>
          </div>

          {/* High Wastage Alerts */}
          <div className="mt-5 ems-card p-4">
            <h3 className="mb-3 font-semibold text-rose-700">High Wastage / Weight Difference Alerts (&gt; 15% Threshold)</h3>
            {(data?.wastageAlerts || []).length === 0 ? (
              <p className="text-xs text-slate-400">No active production runs exceed the 15% wastage/variance threshold.</p>
            ) : (
              <table className="ems-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Production #</th>
                    <th>Plant</th>
                    <th>Product</th>
                    <th>Input KG</th>
                    <th>Wastage / Variance %</th>
                    <th>Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {data.wastageAlerts.map((r: any) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/production/runs/${r.id}`} className="font-semibold text-blue-600 hover:underline">
                          {r.productionNumber}
                        </Link>
                      </td>
                      <td>{r.plant?.name}</td>
                      <td>{r.product?.name}</td>
                      <td>{formatNumber(r.totalInputKg, 0)}</td>
                      <td className="font-bold text-rose-600">{r.hullingWastagePct || r.variancePct || '>15'}%</td>
                      <td>{r.createdBy?.name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </ProductionShell>
  );
}
