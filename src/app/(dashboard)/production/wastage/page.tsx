'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

export default function WastageInventoryPage() {
  const router = useRouter();
  const [starting, setStarting] = useState<string | null>(null);

  const { data: lots, refresh } = useCachedQuery(
    'production:wastage-lots',
    () => api.production.wastageLots(),
    { ttl: PRODUCTION_CACHE_TTL },
  );
  const { data: alerts } = useCachedQuery('production:dashboard', () => api.production.dashboard(), {
    ttl: PRODUCTION_CACHE_TTL,
  });

  async function startSortex(lot: any) {
    setStarting(lot.id);
    try {
      const created = await api.production.startRun({
        plantId: lot.locationId,
        processType: 'SORTEX',
        productId: lot.productId,
        stockCategory: 'WASTAGE_INVENTORY',
        wastageLotId: lot.id,
        quantity: lot.availableKg,
        unit: 'KG',
        startDate: new Date().toISOString().slice(0, 10),
        remarks: `Reprocess wastage ${lot.lotNumber}`,
      });
      showSuccess(`Sortex ${created.productionNumber} started from wastage`);
      invalidateQueryCache('production:');
      router.push(`/production/runs/${created.id}`);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Failed to start Sortex');
    } finally {
      setStarting(null);
    }
  }

  async function discard(lot: any) {
    const reason = window.prompt('Reason for discard?');
    if (reason == null) return;
    try {
      await api.production.discardWastageLot(lot.id, { reason });
      showSuccess('Wastage discarded');
      invalidateQueryCache('production:');
      await refresh();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Discard failed');
    }
  }

  return (
    <ProductionShell title="Wastage Inventory" subtitle="Typed wastage lots · Store for reprocessing via Sortex">
      {(alerts?.wastageAlerts || []).length > 0 && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          High wastage alerts: {alerts.wastageAlerts.length} run(s)
        </div>
      )}

      <div className="ems-card overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-500">
              <th className="px-3 py-2">Lot</th>
              <th>Product</th>
              <th>Type</th>
              <th>Location</th>
              <th>Available</th>
              <th>Cycle</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(lots || []).map((l: any) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{l.lotNumber}</td>
                <td>{l.product?.name}</td>
                <td>{l.wastageType?.nameEn}</td>
                <td>{l.location?.name}</td>
                <td className="font-medium">{formatNumber(l.availableKg, 0)} KG</td>
                <td>{l.reprocessingCycle}</td>
                <td className="text-xs text-slate-500">
                  {l.productionRun?.productionNumber || l.jobWork?.jobWorkNumber || '—'}
                  <br />
                  {formatDate(l.productionDate)}
                </td>
                <td className="space-x-2">
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    disabled={!!starting}
                    onClick={() => startSortex(l)}
                  >
                    {starting === l.id ? '…' : 'Start Sortex'}
                  </button>
                  <button type="button" className="text-rose-600 hover:underline" onClick={() => discard(l)}>
                    Discard
                  </button>
                </td>
              </tr>
            ))}
            {!lots?.length && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  No wastage inventory lots
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ProductionShell>
  );
}
