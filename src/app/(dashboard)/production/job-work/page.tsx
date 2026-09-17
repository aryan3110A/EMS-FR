'use client';

import Link from 'next/link';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

export default function JobWorkListPage() {
  const { data: rows, loading } = useCachedQuery('production:job-work', () => api.production.jobWork.list(), {
    ttl: PRODUCTION_CACHE_TTL,
  });

  return (
    <ProductionShell title="Job Work" subtitle="Material sent outside for processing">
      <div className="mb-4 flex justify-end">
        <Link href="/production/job-work/new" className="ems-btn-primary text-sm">
          New Job Work
        </Link>
      </div>
      <div className="space-y-3">
        {(rows || []).map((j: any) => {
          const processedRecv = (j.inwards || [])
            .flatMap((i: any) => i.lines || [])
            .filter((l: any) => l.returnCategory === 'PROCESSED')
            .reduce((s: number, l: any) => s + l.quantityKg, 0);
          const wastageRecv = (j.inwards || [])
            .flatMap((i: any) => i.lines || [])
            .filter((l: any) => l.returnCategory === 'WASTAGE')
            .reduce((s: number, l: any) => s + l.quantityKg, 0);
          const stillOutside = Math.max(0, (j.totalSentKg || 0) - processedRecv - wastageRecv);
          return (
            <Link key={j.id} href={`/production/job-work/${j.id}`} className="ems-card block p-4 hover:border-blue-300">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">{j.jobWorkNumber}</p>
                  <p className="text-sm text-slate-600">
                    {j.jobWorker?.name} · {j.product?.name} · {j.processType?.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{j.status?.replace(/_/g, ' ')}</p>
                  <p className="text-slate-500">Started {formatDate(j.startDate)}</p>
                </div>
              </div>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
                <div>Sent: {formatNumber(j.totalSentKg, 0)} KG</div>
                <div>Processed recv: {formatNumber(processedRecv, 0)} KG</div>
                <div>Wastage recv: {formatNumber(wastageRecv, 0)} KG</div>
                <div>Still outside: {formatNumber(stillOutside, 0)} KG</div>
              </div>
            </Link>
          );
        })}
        {loading && !rows?.length && <p className="text-sm text-slate-400">Loading…</p>}
        {!loading && !rows?.length && <p className="text-sm text-slate-400">No job works yet</p>}
      </div>
    </ProductionShell>
  );
}
