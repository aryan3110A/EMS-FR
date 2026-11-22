'use client';

import Link from 'next/link';
import { ProductionShell } from '@/components/production/production-shell';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';
import { ContainerKpiPanel } from '@/components/containers/container-kpi-panel';

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
          {/* Inventory KPIs (ERP 22.11.26 §18.1) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {(
              [
                ['Raw / Awaiting Factory Processing', data?.kpis?.rawAwaitingKg ?? data?.inventory?.totalRaw, 'border-l-slate-600', 'Purchased / unprocessed material incl. stock awaiting Sortex'],
                ['Final Processed Inventory', data?.kpis?.finalProcessedKg, 'border-l-emerald-600', 'Unassigned + allocated processed stock'],
                ['Material in Production', data?.kpis?.materialInProductionKg ?? data?.inventory?.totalWip, 'border-l-blue-600', 'Work in progress across plants'],
                ['Processed & Unassigned', data?.kpis?.unassignedKg ?? data?.inventory?.totalProcessed, 'border-l-teal-600', 'Final processed, not yet allocated'],
                ['Allocated to Containers', data?.kpis?.allocatedKg, 'border-l-orange-500', 'Reserved for containers, not yet dispatched'],
              ] as [string, number | undefined, string, string][]
            ).map(([label, kg, border, hint]) => (
              <div key={label} className={`ems-card border-l-4 ${border} p-4`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {formatNumber(Number(kg || 0), 0)} <span className="text-xs font-normal text-slate-500">KG</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">{hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* Product-wise Hulled Sesame (§18.2) */}
            {data?.hulledSesame && (
              <div className="ems-card p-4">
                <h3 className="mb-3 font-semibold text-slate-800">Hulled Sesame Seeds</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {(
                      [
                        ['Purchased Hulled Awaiting Sortex', data.hulledSesame.rawKg, ''],
                        ['Final Processed Hulled', data.hulledSesame.finalProcessedKg, 'font-semibold'],
                        ['↳ Processed & Unassigned', data.hulledSesame.unassignedKg, 'pl-4 text-slate-600'],
                        ['↳ Allocated Processed Stock', data.hulledSesame.allocatedKg, 'pl-4 text-slate-600'],
                      ] as [string, number, string][]
                    ).map(([label, kg, cls]) => (
                      <tr key={label} className="border-b border-slate-100">
                        <td className={`py-1.5 ${cls}`}>{label}</td>
                        <td className="py-1.5 text-right font-medium tabular-nums">{formatNumber(kg, 0)} KG</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-1.5">Pending Eligible Contracts</td>
                      <td className="py-1.5 text-right font-medium">{data.hulledSesame.eligiblePendingContracts}</td>
                    </tr>
                  </tbody>
                </table>
                {data.hulledSesame.unassignedMessage && (
                  <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{data.hulledSesame.unassignedMessage}</p>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Natural Sesame (Hulling + Sortex) and purchased Hulled Sesame (Sortex) both feed this one finished product.
                </p>
              </div>
            )}

            {/* Lot KPIs (§17.5) */}
            {data?.lots && (
              <div className="ems-card p-4">
                <h3 className="mb-3 font-semibold text-slate-800">Production Lots</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(
                    [
                      ['Total Lots in Factory', data.lots.inFactory],
                      ['Lots in Production', data.lots.inProduction],
                      ['Finalized Lots', data.lots.finalised],
                      ['Processed & Unassigned Lots', data.lots.unassigned],
                      ['Lots Allocated to Containers', data.lots.allocated],
                    ] as [string, number][]
                  ).map(([label, n]) => (
                    <div key={label} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-1 text-xl font-bold text-slate-800">{n}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5">
            <ContainerKpiPanel />
          </div>

          {/* Unassigned processed stock aging */}
          <div className="mt-5 ems-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">Unassigned Processed Stock Aging</h3>
                <p className="text-xs text-slate-500">Available processed lots waiting to be allocated to contracts.</p>
              </div>
              <Link href="/production/fulfilment" className="text-xs font-medium text-blue-600 hover:underline">
                Fulfilment →
              </Link>
            </div>
            {!(data?.aging?.unassignedInventory || []).length ? (
              <p className="py-6 text-center text-xs text-slate-400">No unassigned processed lots in inventory.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-slate-500">
                      <th className="px-2 py-2">Production / Lot</th>
                      <th className="px-2 py-2">Product</th>
                      <th className="px-2 py-2">Plant</th>
                      <th className="px-2 py-2 text-right">Available (KG)</th>
                      <th className="px-2 py-2 text-right">Unassigned for</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.aging.unassignedInventory.map((lot: any) => {
                      const days = Number(lot.daysUnassigned || 0);
                      const badge =
                        days > 60
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : days > 30
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200';
                      return (
                        <tr key={lot.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-2 py-1.5 font-mono font-medium text-slate-800">{lot.productionNumber}</td>
                          <td className="px-2 py-1.5">{lot.product}</td>
                          <td className="px-2 py-1.5 text-slate-600">{lot.plant}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-slate-900">{formatNumber(lot.availableUnassignedKg, 0)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge}`}>
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
