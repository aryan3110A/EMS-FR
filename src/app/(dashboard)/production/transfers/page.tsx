'use client';

import { useState } from 'react';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { EmsSelect } from '@/components/ui/ems-select';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

export default function TransfersPage() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    transferDate: new Date().toISOString().slice(0, 10),
    sourceLocationId: '',
    destLocationId: '',
    stockCategory: 'RAW_MATERIAL',
    productId: '',
    quantity: 0,
    unit: 'MT',
    remarks: '',
  });

  const { data: rows, refresh } = useCachedQuery('production:transfers', () => api.production.transfers(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: locations } = useCachedQuery('production:locations', () => api.production.locations(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: products } = useCachedQuery('masters:products', () => api.masters.products(), {
    ttl: PRODUCTION_CACHE_TTL,
  });

  async function afterMutation() {
    invalidateQueryCache('production:');
    await refresh();
  }

  async function create() {
    setSaving(true);
    try {
      await api.production.createTransfer({ ...form, quantity: Number(form.quantity) });
      showSuccess('Transfer created');
      setOpen(false);
      await afterMutation();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function dispatch(id: string) {
    try {
      await api.production.dispatchTransfer(id);
      showSuccess('Dispatched — stock in transit');
      await afterMutation();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Dispatch failed');
    }
  }

  async function receive(id: string) {
    try {
      await api.production.receiveTransfer(id);
      showSuccess('Received at destination');
      await afterMutation();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Receive failed');
    }
  }

  return (
    <ProductionShell title="Plant Transfer" subtitle="Move stock between plants with dispatch / receive">
      <div className="mb-4 flex justify-end">
        <button type="button" className="ems-btn-primary text-sm" onClick={() => setOpen(true)}>
          + New Transfer
        </button>
      </div>

      <div className="space-y-3">
        {(rows || []).map((t: any) => (
          <div key={t.id} className="ems-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{t.transferNumber || t.id.slice(0, 8)}</p>
                <p className="text-sm text-slate-600">
                  {t.sourceLocation?.name} → {t.destLocation?.name} · {t.product?.name}
                </p>
                <p className="text-sm text-slate-500">
                  {formatDate(t.transferDate)} · {formatNumber(Number(t.quantityKg) / 1000, 3)} MT ·{' '}
                  {t.stockCategory?.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{t.status?.replace(/_/g, ' ')}</p>
                <div className="mt-2 flex gap-2">
                  {t.status === 'DRAFT' || t.status === 'APPROVED' ? (
                    <button type="button" className="ems-btn-secondary text-xs" onClick={() => dispatch(t.id)}>
                      Dispatch
                    </button>
                  ) : null}
                  {t.status === 'IN_TRANSIT' || t.status === 'DISPATCHED' ? (
                    <button type="button" className="ems-btn-primary text-xs" onClick={() => receive(t.id)}>
                      Receive
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
        {!rows?.length && <p className="text-sm text-slate-400">No plant transfers yet</p>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">New plant transfer</h3>
            <div className="space-y-3">
              <input
                className="ems-input w-full"
                type="date"
                value={form.transferDate}
                onChange={(e) => setForm((f) => ({ ...f, transferDate: e.target.value }))}
              />
              <EmsSelect
                value={form.sourceLocationId}
                onChange={(v) => setForm((f) => ({ ...f, sourceLocationId: v }))}
                placeholder="Source plant *"
                options={[{ value: '', label: 'All plants' }, ...(locations || []).map((l: any) => ({ value: l.id, label: l.name }))]}
              />
              <EmsSelect
                value={form.destLocationId}
                onChange={(v) => setForm((f) => ({ ...f, destLocationId: v }))}
                placeholder="Destination plant *"
                options={[{ value: '', label: 'All plants' }, ...(locations || []).map((l: any) => ({ value: l.id, label: l.name }))]}
              />
              <EmsSelect
                value={form.stockCategory}
                onChange={(v) => setForm((f) => ({ ...f, stockCategory: v }))}
                placeholder="Stock category"
                options={[
                  { value: 'RAW_MATERIAL', label: 'Raw Material' },
                  { value: 'PROCESSED_AVAILABLE', label: 'Processed' },
                  { value: 'SAMPLE_REJECTED', label: 'Sample Rejected' },
                ]}
              />
              <EmsSelect
                value={form.productId}
                onChange={(v) => setForm((f) => ({ ...f, productId: v }))}
                placeholder="Product *"
                options={[{ value: '', label: 'All products' }, ...(products || []).map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
                searchable
              />
              <div className="flex gap-2">
                <input
                  className="ems-input w-full"
                  type="number"
                  step="0.001"
                  placeholder="Quantity"
                  value={form.quantity || ''}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                />
                <EmsSelect
                  value={form.unit}
                  onChange={(v) => setForm((f) => ({ ...f, unit: v }))}
                  placeholder="Unit"
                  options={[
                    { value: 'MT', label: 'MT' },
                    { value: 'KG', label: 'KG' },
                  ]}
                />
              </div>
              <textarea
                className="ems-input w-full min-h-[60px]"
                placeholder="Remarks"
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="ems-btn-secondary text-sm" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="ems-btn-primary text-sm" disabled={saving} onClick={create}>
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProductionShell>
  );
}
