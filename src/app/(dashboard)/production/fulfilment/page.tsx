'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { EmsSelect } from '@/components/ui/ems-select';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';
import { formatNumber } from '@/lib/utils';

export default function FulfilmentPage() {
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [quantityKg, setQuantityKg] = useState(0);
  const [saving, setSaving] = useState(false);

  const { data: products } = useCachedQuery('masters:products', () => api.masters.products(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: stock, refresh: refreshStock } = useCachedQuery(
    productId ? `fulfilment:stock:${productId}:${locationId || 'all'}` : 'fulfilment:stock:none',
    () => (productId ? api.production.fulfilmentStock(productId, locationId || undefined) : Promise.resolve(null)),
    { ttl: 30_000, enabled: !!productId },
  );
  const { data: matching, refresh: refreshMatching } = useCachedQuery(
    productId ? `fulfilment:match:${productId}` : 'fulfilment:match:none',
    () => (productId ? api.production.matchingContainers(productId) : Promise.resolve([])),
    { ttl: 30_000, enabled: !!productId },
  );

  useEffect(() => {
    setSelectedKey('');
    setQuantityKg(0);
    if (!locationId && stock?.byLocation?.length === 1) {
      setLocationId(stock.byLocation[0].locationId);
    }
  }, [productId, stock?.byLocation]);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return (matching || []).find(
      (m: any) => `${m.contractId}:${m.containerId}:${m.productLines?.[0]?.id || ''}` === selectedKey,
    );
  }, [matching, selectedKey]);

  const availableAtLocation = useMemo(() => {
    if (!stock) return 0;
    if (locationId) {
      return stock.byLocation?.find((l: any) => l.locationId === locationId)?.availableKg || 0;
    }
    return stock.totalAvailableKg || 0;
  }, [stock, locationId]);

  async function submit() {
    if (!productId || !locationId || !selected || !quantityKg) {
      showError('Select product, location, container and quantity');
      return;
    }
    const line = selected.productLines?.[0];
    const max = Math.min(availableAtLocation, line?.pendingKg || 0);
    if (quantityKg > max + 0.001) {
      showError(`Maximum allocation: ${formatNumber(max, 0)} KG`);
      return;
    }
    setSaving(true);
    try {
      await api.production.fulfilmentAllocate({
        productId,
        locationId,
        contractId: selected.contractId,
        containerId: selected.containerId,
        containerProductId: line?.id || undefined,
        quantityKg: Number(quantityKg),
      });
      showSuccess('Allocated from processed inventory (FIFO)');
      setQuantityKg(0);
      setSelectedKey('');
      invalidateQueryCache('production:');
      invalidateQueryCache('fulfilment:');
      await Promise.all([refreshStock(), refreshMatching()]);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Fulfilment failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProductionShell
      title="Fulfilment"
      subtitle="Select processed product → matching contracts only → allocate (FIFO lots)"
    >
      <div className="ems-card mb-4 space-y-4 p-4">
        <div>
          <label className="ems-label">1. Processed Product</label>
          <EmsSelect
            value={productId}
            onChange={(v) => {
              setProductId(v);
              setLocationId('');
            }}
            placeholder="Select product *"
            options={[
              { value: '', label: 'Select product' },
              ...(products || []).map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
            ]}
            searchable
          />
        </div>

        {productId && stock && (
          <div>
            <p className="ems-label">2. Processed Stock</p>
            <p className="mb-2 text-lg font-semibold text-slate-800">
              Available: {formatNumber(stock.totalAvailableKg || 0, 0)} KG
            </p>
            <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(stock.byLocation || []).map((l: any) => (
                <button
                  key={l.locationId}
                  type="button"
                  onClick={() => setLocationId(l.locationId)}
                  className={`rounded-lg border p-3 text-left text-sm ${
                    locationId === l.locationId ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                  }`}
                >
                  <p className="font-medium">{l.locationName}</p>
                  <p className="tabular-nums">{formatNumber(l.availableKg, 0)} KG</p>
                </button>
              ))}
            </div>
            {!stock.byLocation?.length && (
              <p className="text-sm text-slate-500">No available processed stock for this product.</p>
            )}
          </div>
        )}

        {productId && (
          <div>
            <p className="ems-label">3. Matching Contracts / Containers</p>
            <p className="mb-2 text-xs text-slate-500">Only containers requiring this exact product are shown.</p>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {(matching || []).map((m: any) => {
                const line = m.productLines?.[0];
                const key = `${m.contractId}:${m.containerId}:${line?.id || ''}`;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    className={`w-full rounded-lg border p-3 text-left text-sm ${
                      selectedKey === key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">
                        {m.contractNumber} · C{m.containerIndex}
                      </span>
                      <span className="text-slate-500">{m.euClassification}</span>
                    </div>
                    <p className="text-slate-600">
                      {m.buyer?.name || '—'} · Pending {formatNumber(line?.pendingKg || 0, 0)} KG
                      {m.expectedShipmentDate ? ` · Due ${String(m.expectedShipmentDate).slice(0, 10)}` : ''}
                    </p>
                  </button>
                );
              })}
              {!matching?.length && (
                <p className="text-sm text-slate-400">No pending containers require this product.</p>
              )}
            </div>
          </div>
        )}

        {selected && locationId && (
          <div>
            <label className="ems-label">4. Quantity to fulfil (KG)</label>
            <p className="mb-1 text-xs text-slate-500">
              Max {formatNumber(Math.min(availableAtLocation, selected.productLines?.[0]?.pendingKg || 0), 0)} KG
              (stock vs pending). Lots consumed automatically FIFO.
            </p>
            <input
              className="ems-input w-full max-w-xs"
              type="number"
              step="0.001"
              value={quantityKg || ''}
              onChange={(e) => setQuantityKg(Number(e.target.value))}
            />
            <button
              type="button"
              className="ems-btn-primary mt-3 text-sm"
              disabled={saving}
              onClick={submit}
            >
              {saving ? 'Allocating…' : 'Allocate'}
            </button>
          </div>
        )}
      </div>
    </ProductionShell>
  );
}
