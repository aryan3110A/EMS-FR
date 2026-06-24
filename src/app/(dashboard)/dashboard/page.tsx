'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/sidebar';
import { DashboardSkeleton } from '@/components/ui/page-loader';
import { UpcomingProductChart } from '@/components/dashboard/upcoming-product-chart';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, statusBadge, statusLabel } from '@/lib/utils';
import { FileText, Clock, CheckCircle, Factory, Ship, Anchor } from 'lucide-react';

export default function DashboardPage() {
  const { data: stats, loading } = useCachedQuery('dashboard', () => api.dashboard());
  const [productFilter, setProductFilter] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const upcoming = stats?.upcoming;

  const filteredShipments = useMemo(() => {
    const rows = upcoming?.shipments ?? [];
    if (!productFilter) return rows;
    return rows.filter((s) => s.product === productFilter);
  }, [upcoming, productFilter]);

  const cards = [
    { label: 'Total Contracts', value: stats?.total ?? 0, icon: FileText, color: 'text-blue-600 bg-blue-50' },
    { label: 'Draft', value: stats?.draft ?? 0, icon: Clock, color: 'text-slate-600 bg-slate-100' },
    { label: 'Under Preparation', value: stats?.underPreparation ?? stats?.draft ?? 0, icon: Clock, color: 'text-orange-600 bg-orange-50' },
    { label: 'Confirmed for Production', value: stats?.confirmed ?? 0, icon: Factory, color: 'text-purple-600 bg-purple-50' },
    { label: 'Ready for Dispatch', value: stats?.ready ?? 0, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Containers Shipped', value: stats?.containersShipped ?? 0, icon: Ship, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Reached Port', value: stats?.containersReachedPort ?? 0, icon: Anchor, color: 'text-teal-600 bg-teal-50' },
  ];

  if (loading && !stats) {
    return (
      <AppShell title="Dashboard">
        <DashboardSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="ems-card p-5 transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-3xl font-bold text-slate-800 tabular-nums">{value}</p>
              </div>
              <div className={`rounded-lg p-2 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {upcoming && (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <p className="text-sm text-slate-600">
              Showing expected shipments from <strong>{formatDate(upcoming.from)}</strong> to{' '}
              <strong>{formatDate(upcoming.to)}</strong>
            </p>
            <select
              className="ems-input max-w-xs text-sm"
              value={productFilter ?? ''}
              onChange={(e) => setProductFilter(e.target.value || null)}
            >
              <option value="">All products</option>
              {upcoming.byProduct.map((p) => (
                <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="ems-card p-5 lg:col-span-1">
              <h2 className="font-semibold text-slate-800">Upcoming Summary</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Containers</dt><dd className="font-semibold">{upcoming.totalContainers}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Total MT</dt><dd className="font-semibold">{upcoming.totalMt}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Contracts</dt><dd className="font-semibold">{upcoming.contractCount}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Products</dt><dd className="font-semibold">{upcoming.productCount}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">1st / 2nd Half</dt><dd className="font-semibold">{upcoming.byPeriod.FIRST_HALF} / {upcoming.byPeriod.SECOND_HALF}</dd></div>
              </dl>
            </div>
            <div className="ems-card p-5 lg:col-span-2">
              <h2 className="mb-3 font-semibold text-slate-800">Upcoming Containers by Product</h2>
              <UpcomingProductChart
                data={upcoming.byProduct}
                selected={selectedProduct}
                onSelect={(row) => {
                  setSelectedProduct(row.code);
                  setProductFilter(row.code);
                }}
              />
            </div>
          </div>

          <div className="mt-6 ems-card">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-800">Upcoming Shipments</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="ems-table w-full">
                <thead>
                  <tr>
                    <th>Expected Date</th>
                    <th>Contract</th>
                    <th>Container</th>
                    <th>Buyer</th>
                    <th>Product</th>
                    <th>MT</th>
                    <th>Port</th>
                    <th>Period</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShipments.map((s) => (
                    <tr key={s.id}>
                      <td>{formatDate(s.expectedShipmentDate)}</td>
                      <td>
                        <Link href={`/contracts/${s.contractId}`} className="font-medium text-blue-600 hover:underline">
                          {s.contractNumber}
                        </Link>
                      </td>
                      <td>{s.containerIndex}</td>
                      <td>{s.buyer ?? '—'}</td>
                      <td>{s.product ?? '—'}</td>
                      <td>{s.quantityMt ?? '—'}</td>
                      <td>{s.destinationPort ?? '—'}</td>
                      <td>{s.shipmentHalf === 'FIRST_HALF' ? '1–15' : s.shipmentHalf === 'SECOND_HALF' ? '16–end' : '—'}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(s.status ?? '')}`}>
                          {statusLabel(s.status ?? '')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!filteredShipments.length && (
                    <tr><td colSpan={9} className="py-8 text-center text-slate-400">No upcoming shipments</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="mt-6 ems-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-800">Recent Contracts</h2>
          <Link href="/contracts" className="text-sm text-blue-600 hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="ems-table w-full">
            <thead>
              <tr>
                <th>Contract No.</th>
                <th>Received</th>
                <th>Salesperson</th>
                <th>Buyer</th>
                <th>Product</th>
                <th>MT</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recent ?? []).map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/contracts/${c.id}`} className="font-medium text-blue-600 hover:underline">
                      {c.contractNumber}
                    </Link>
                  </td>
                  <td>{formatDate(c.receivedDate)}</td>
                  <td>{c.salesperson?.name ?? '—'}</td>
                  <td>{c.buyer?.name}</td>
                  <td>{c.product?.code}</td>
                  <td>{c.totalMt}</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(c.status)}`}>
                      {statusLabel(c.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
