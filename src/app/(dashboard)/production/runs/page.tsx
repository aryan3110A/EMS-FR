'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { EmsSelect } from '@/components/ui/ems-select';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

export default function ProductionRunsPage() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    processType: 'FULL_PROCESS',
    plantId: '',
    productId: '',
    supplierId: '',
    stockCategory: 'NORMAL_RAW_MATERIAL',
    quantity: 0,
    unit: 'MT',
    startDate: new Date().toISOString().slice(0, 10),
    remarks: '',
  });

  const { data: runs } = useCachedQuery('production:runs', () => api.production.runs(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: locations } = useCachedQuery('production:locations', () => api.production.locations(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: products } = useCachedQuery('masters:products', () => api.masters.products(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: suppliers } = useCachedQuery('production:suppliers', () => api.production.suppliers(), {
    ttl: PRODUCTION_CACHE_TTL,
  });

  async function start() {
    setSaving(true);
    try {
      const created = await api.production.startRun({
        ...form,
        quantity: Number(form.quantity),
        supplierId: form.supplierId || undefined,
      });
      showSuccess(`Production ${created.productionNumber} started`);
      setOpen(false);
      invalidateQueryCache('production:');
      window.location.href = `/production/runs/${created.id}`;
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Failed to start production');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProductionShell title="Production Runs" subtitle="Stage-wise cleaning → hulling → allocation">
      <div className="mb-4 flex justify-end">
        <button type="button" className="ems-btn-primary text-sm" onClick={() => setOpen(true)}>
          Start New Production
        </button>
      </div>
      <div className="space-y-3">
        {(runs || []).map((r: any) => (
          <Link key={r.id} href={`/production/runs/${r.id}`} className="ems-card block p-4 hover:border-blue-300">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold">{r.productionNumber}</p>
                <p className="text-sm text-slate-600">
                  {r.product?.name} · {r.plant?.name} · {r.processType?.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium">{r.status?.replace(/_/g, ' ')}</p>
                <p className="text-slate-500">Started {formatDate(r.startDate)}</p>
                {r.wastageAlert && <p className="font-semibold text-rose-600">High wastage</p>}
              </div>
            </div>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
              <div>Input: {formatNumber(r.totalInputKg / 1000, 3)} MT</div>
              <div>Output: {formatNumber(r.netOutputKg / 1000, 3)} MT</div>
              <div>Allocated: {formatNumber(r.allocatedKg / 1000, 3)} MT</div>
              <div>Wastage: {r.hullingWastagePct != null ? `${r.hullingWastagePct}%` : '—'}</div>
            </div>
          </Link>
        ))}
        {!runs?.length && <p className="text-sm text-slate-400">No production runs yet</p>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Start Production</h3>
            <div className="space-y-3">
              <EmsSelect
                value={form.processType}
                onChange={(v) => setForm((f) => ({ ...f, processType: v }))}
                placeholder="Process type"
                options={[
                  { value: 'FULL_PROCESS', label: 'Full Process' },
                  { value: 'SORTEX', label: 'Sortex' },
                ]}
              />
              <EmsSelect
                value={form.plantId}
                onChange={(v) => setForm((f) => ({ ...f, plantId: v }))}
                placeholder="Plant *"
                options={[{ value: '', label: 'All plants' }, ...(locations || []).map((l: any) => ({ value: l.id, label: l.name }))]}
              />
              <EmsSelect
                value={form.productId}
                onChange={(v) => setForm((f) => ({ ...f, productId: v }))}
                placeholder="Product *"
                options={[{ value: '', label: 'All products' }, ...(products || []).map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
                searchable
              />
              <EmsSelect
                value={form.stockCategory}
                onChange={(v) => setForm((f) => ({ ...f, stockCategory: v }))}
                placeholder="Stock category"
                options={[
                  { value: 'NORMAL_RAW_MATERIAL', label: 'Normal Raw Material' },
                  { value: 'EXISTING_PROCESSED_STOCK', label: 'Existing Processed Stock' },
                  { value: 'SAMPLE_REJECTED_STOCK', label: 'Sample-Rejected Stock (Sortex only)' },
                ]}
              />
              <EmsSelect
                value={form.supplierId}
                onChange={(v) => setForm((f) => ({ ...f, supplierId: v }))}
                placeholder="Source party (optional)"
                options={[{ value: '', label: 'No party' }, ...(suppliers || []).map((s: any) => ({ value: s.id, label: s.name }))]}
              />
              <div className="flex gap-2">
                <input className="ems-input w-full" type="number" step="0.001" placeholder="Quantity" value={form.quantity || ''} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
                <EmsSelect value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} placeholder="Unit" options={[{ value: 'MT', label: 'MT' }, { value: 'KG', label: 'KG' }]} />
              </div>
              <input className="ems-input w-full" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              <textarea className="ems-input w-full min-h-[60px]" placeholder="Remarks" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="ems-btn-secondary text-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="ems-btn-primary text-sm" disabled={saving} onClick={start}>{saving ? 'Starting…' : 'Start Production'}</button>
            </div>
          </div>
        </div>
      )}
    </ProductionShell>
  );
}
