'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/sidebar';
import { DashboardSkeleton } from '@/components/ui/page-loader';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, statusBadge, statusLabel } from '@/lib/utils';
import { FileText, Clock, CheckCircle, Factory } from 'lucide-react';

export default function DashboardPage() {
  const { data: stats, loading } = useCachedQuery('dashboard', () => api.dashboard());

  const cards = [
    { label: 'Total Contracts', value: stats?.total ?? 0, icon: FileText, color: 'text-blue-600 bg-blue-50' },
    { label: 'Draft', value: stats?.draft ?? 0, icon: Clock, color: 'text-slate-600 bg-slate-100' },
    { label: 'Confirmed for Production', value: stats?.confirmed ?? 0, icon: Factory, color: 'text-purple-600 bg-purple-50' },
    { label: 'Ready for Dispatch', value: stats?.ready ?? 0, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
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
          <div key={label} className="ems-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-3xl font-bold text-slate-800">{value}</p>
              </div>
              <div className={`rounded-lg p-2 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

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
              {!stats?.recent?.length && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">No contracts yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
