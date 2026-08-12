'use client';

import { useState } from 'react';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { EmsSelect } from '@/components/ui/ems-select';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';
import { formatNumber } from '@/lib/utils';

export default function FulfilmentPage() {
  const [form, setForm] = useState({
    processedLotId: '',
    contractId: '',
    containerId: '',
    productId: '',
    containerProductId: '',
    quantity: 0,
    unit: 'MT',
  });
  const [saving, setSaving] = useState(false);

  const { data: pending, refresh: refreshPending } = useCachedQuery(
    'production:pending-contracts',
    () => api.production.pendingContracts(),
    { ttl: PRODUCTION_CACHE_TTL },
  );
  const { data: allLots, refresh: refreshLots } = useCachedQuery(
    'production:processed-lots',
    () => api.production.processedLots(),
    { ttl: PRODUCTION_CACHE_TTL },
  );
  const lots = (allLots || []).filter((x: any) => Number(x.availableKg ?? x.remainingKg ?? x.quantityKg ?? 0) > 0.001);

  const contract = (pending || []).find((c: any) => c.id === form.contractId);
  const container = contract?.containers?.find((ct: any) => ct.id === form.containerId);

  async function submit() {
    setSaving(true);
    try {
      await api.production.allocateFromStock({
        ...form,
        quantity: Number(form.quantity),
        containerProductId: form.containerProductId || undefined,
      });
      showSuccess('Allocated from processed stock');
      setForm({ processedLotId: '', contractId: '', containerId: '', productId: '', containerProductId: '', quantity: 0, unit: 'MT' });
      invalidateQueryCache('production:');
      await Promise.all([refreshPending(), refreshLots()]);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Fulfilment failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProductionShell title="Fulfilment from Stock" subtitle="Allocate existing processed lots to containers">
      <div className="ems-card mb-4 p-4">
        <h3 className="mb-3 font-semibold">Allocate from processed inventory</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <EmsSelect
            value={form.processedLotId}
            onChange={(v) => setForm((f) => ({ ...f, processedLotId: v }))}
            placeholder="Processed lot *"
            options={[
              { value: '', label: 'All lots' },
              ...lots.map((l) => ({
                value: l.id,
                label: `${l.lotNumber || l.id.slice(0, 8)} · ${l.product?.name || ''} · ${formatNumber((l.remainingKg ?? l.quantityKg) / 1000, 3)} MT`,
              })),
            ]}
            searchable
          />
          <select
            className="ems-input"
            value={form.contractId}
            onChange={(e) => setForm((f) => ({ ...f, contractId: e.target.value, containerId: '', productId: '', containerProductId: '' }))}
          >
            <option value="">Contract</option>
            {(pending || []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.contractNumber} — {c.buyer?.name}
              </option>
            ))}
          </select>
          <select
            className="ems-input"
            value={form.containerId}
            onChange={(e) => setForm((f) => ({ ...f, containerId: e.target.value, productId: '', containerProductId: '' }))}
          >
            <option value="">Container</option>
            {(contract?.containers || []).map((ct: any) => (
              <option key={ct.id} value={ct.id}>
                Container {ct.containerIndex} · pending {formatNumber(ct.pendingMt, 3)} MT
              </option>
            ))}
          </select>
          <select
            className="ems-input"
            value={form.containerProductId || form.productId}
            onChange={(e) => {
              const line = container?.productLines?.find((p: any) => (p.id || p.productId) === e.target.value);
              setForm((f) => ({ ...f, productId: line?.productId || '', containerProductId: line?.id || '' }));
            }}
          >
            <option value="">Product line</option>
            {(container?.productLines || []).map((p: any) => (
              <option key={p.id || p.productId} value={p.id || p.productId}>
                {p.product?.name || p.productId} · pending {formatNumber(p.pendingKg / 1000, 3)} MT
              </option>
            ))}
          </select>
          <input
            className="ems-input"
            type="number"
            step="0.001"
            placeholder="Quantity MT"
            value={form.quantity || ''}
            onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value), unit: 'MT' }))}
          />
        </div>
        <button type="button" className="ems-btn-primary mt-3 text-sm" disabled={saving} onClick={submit}>
          {saving ? 'Allocating…' : 'Allocate to Container'}
        </button>
      </div>

      <div className="ems-card p-4">
        <h3 className="mb-3 font-semibold">Available processed lots</h3>
        <table className="ems-table w-full text-sm">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Product</th>
              <th>Plant</th>
              <th>Remaining MT</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((l) => (
              <tr key={l.id}>
                <td>{l.lotNumber || l.id.slice(0, 8)}</td>
                <td>{l.product?.name}</td>
                <td>{l.location?.name || l.plant?.name}</td>
                <td>{formatNumber((l.remainingKg ?? l.quantityKg) / 1000, 3)}</td>
                <td>{l.status || 'AVAILABLE'}</td>
              </tr>
            ))}
            {!lots.length && (
              <tr>
                <td colSpan={5} className="text-slate-400">
                  No processed stock available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ProductionShell>
  );
}
