'use client';

import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

export default function PendingContractsPage() {
  const { data: rows, loading } = useCachedQuery(
    'production:pending-contracts',
    () => api.production.pendingContracts(),
    { ttl: PRODUCTION_CACHE_TTL },
  );

  return (
    <ProductionShell title="Pending Contracts" subtitle="Contracts still requiring production">
      {loading && !rows ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-3">
          {(rows || []).map((c: any) => (
            <div
              key={c.id}
              className={`rounded-xl border p-4 ${
                c.urgency === 'RED'
                  ? 'border-red-300 bg-red-50'
                  : c.urgency === 'YELLOW'
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{c.contractNumber}</p>
                  <p className="text-sm text-slate-600">
                    {c.buyer?.name} · {c.euClassification || '—'}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{c.daysLabel}</p>
                  <p className="text-slate-500">Due: {formatDate(c.dueDate)}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                <div>
                  Required: <strong>{formatNumber(c.requiredMt, 3)} MT</strong>
                </div>
                <div>
                  Fulfilled: <strong>{formatNumber(c.fulfilledMt, 3)} MT</strong>
                </div>
                <div>
                  Pending: <strong>{formatNumber(c.pendingMt, 3)} MT</strong>
                </div>
                <div>
                  Containers: <strong>{c.containers?.length}</strong>
                </div>
              </div>
            </div>
          ))}
          {!rows?.length && <p className="text-sm text-slate-400">No pending production contracts</p>}
        </div>
      )}
    </ProductionShell>
  );
}
