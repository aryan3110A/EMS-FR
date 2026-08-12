'use client';

import { useMemo, useState } from 'react';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { EmsSelect } from '@/components/ui/ems-select';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

export default function InwardPage() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState({
    supplierId: '',
    productId: '',
    locationId: '',
    inwardTypeId: '',
    truckNumber: '',
    inwardNumber: '',
  });
  const [filters, setFilters] = useState(applied);
  const [form, setForm] = useState({
    supplierId: '',
    inwardDate: new Date().toISOString().slice(0, 10),
    truckNumber: '',
    productId: '',
    numberOfBags: 0,
    weight: 0,
    unit: 'MT',
    price: '',
    inwardTypeId: '',
    otherTypeDesc: '',
    locationId: '',
    remarks: '',
  });

  const filterKey = useMemo(
    () =>
      Object.entries(applied)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join('&') || 'all',
    [applied],
  );

  const { data: rows, refresh: refreshInwards } = useCachedQuery(
    `production:inwards:${filterKey}`,
    () => {
      const params: Record<string, string> = {};
      Object.entries(applied).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      return api.production.inwards(params);
    },
    { ttl: PRODUCTION_CACHE_TTL },
  );
  const { data: products } = useCachedQuery('masters:products', () => api.masters.products(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: locations } = useCachedQuery('production:locations', () => api.production.locations(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: suppliers } = useCachedQuery('production:suppliers', () => api.production.suppliers(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: types } = useCachedQuery('production:inward-types', () => api.production.inwardTypes(), {
    ttl: PRODUCTION_CACHE_TTL,
  });

  const selectedType = (types || []).find((t: any) => t.id === form.inwardTypeId);

  async function save() {
    setSaving(true);
    try {
      await api.production.createInward({
        ...form,
        numberOfBags: Number(form.numberOfBags) || 0,
        weight: Number(form.weight),
        price: form.price ? Number(form.price) : undefined,
        otherTypeDesc: form.otherTypeDesc || undefined,
      });
      showSuccess('Inward created — raw material inventory updated');
      setOpen(false);
      invalidateQueryCache('production:');
      await refreshInwards();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Failed to create inward');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProductionShell title="Raw Material Inward" subtitle="Receive stock into location inventory">
      <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <input className="ems-input" placeholder="Inward No" value={filters.inwardNumber} onChange={(e) => setFilters((f) => ({ ...f, inwardNumber: e.target.value }))} />
        <input className="ems-input" placeholder="Truck" value={filters.truckNumber} onChange={(e) => setFilters((f) => ({ ...f, truckNumber: e.target.value }))} />
        <EmsSelect
          value={filters.supplierId}
          onChange={(v) => setFilters((f) => ({ ...f, supplierId: v }))}
          placeholder="Party"
          options={[{ value: '', label: 'All parties' }, ...(suppliers || []).map((s: any) => ({ value: s.id, label: s.name }))]}
        />
        <EmsSelect
          value={filters.productId}
          onChange={(v) => setFilters((f) => ({ ...f, productId: v }))}
          placeholder="Product"
          searchable
          options={[{ value: '', label: 'All products' }, ...(products || []).map((p: any) => ({ value: p.id, label: p.code }))]}
        />
        <EmsSelect
          value={filters.locationId}
          onChange={(v) => setFilters((f) => ({ ...f, locationId: v }))}
          placeholder="Location"
          options={[{ value: '', label: 'All locations' }, ...(locations || []).map((l: any) => ({ value: l.id, label: l.name }))]}
        />
        <button type="button" className="ems-btn-secondary text-sm" onClick={() => setApplied({ ...filters })}>
          Apply filters
        </button>
      </div>
      <div className="mb-4 flex justify-end">
        <button type="button" className="ems-btn-primary text-sm" onClick={() => setOpen(true)}>
          + New Inward
        </button>
      </div>
      <div className="ems-card overflow-x-auto p-4">
        <table className="ems-table w-full text-sm">
          <thead>
            <tr>
              <th>Inward No</th>
              <th>Date</th>
              <th>Party</th>
              <th>Product</th>
              <th>Truck</th>
              <th>Weight</th>
              <th>Location</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r: any) => (
              <tr key={r.id}>
                <td className="font-medium">{r.inwardNumber}</td>
                <td>{formatDate(r.inwardDate)}</td>
                <td>{r.supplier?.name}</td>
                <td>{r.product?.name}</td>
                <td>{r.truckNumber}</td>
                <td>
                  {formatNumber(r.weightKg / 1000, 3)} MT ({formatNumber(r.weightKg, 0)} kg)
                </td>
                <td>{r.location?.name}</td>
                <td>{r.inwardType?.name}</td>
              </tr>
            ))}
            {!rows?.length && (
              <tr>
                <td colSpan={8} className="text-center text-slate-400">
                  No inwards yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Create Inward</h3>
            <div className="space-y-3">
              <EmsSelect
                value={form.supplierId}
                onChange={(v) => setForm((f) => ({ ...f, supplierId: v }))}
                placeholder="Party *"
                options={[{ value: '', label: 'All parties' }, ...(suppliers || []).map((s: any) => ({ value: s.id, label: s.name }))]}
              />
              <input className="ems-input w-full" type="date" value={form.inwardDate} onChange={(e) => setForm((f) => ({ ...f, inwardDate: e.target.value }))} />
              <input className="ems-input w-full" placeholder="Truck number *" value={form.truckNumber} onChange={(e) => setForm((f) => ({ ...f, truckNumber: e.target.value }))} />
              <EmsSelect
                value={form.productId}
                onChange={(v) => setForm((f) => ({ ...f, productId: v }))}
                placeholder="Product *"
                options={[{ value: '', label: 'All products' }, ...(products || []).map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
                searchable
              />
              <div className="flex gap-2">
                <input className="ems-input w-full" type="number" placeholder="Bags" value={form.numberOfBags} onChange={(e) => setForm((f) => ({ ...f, numberOfBags: Number(e.target.value) }))} />
                <input className="ems-input w-full" type="number" step="0.001" placeholder="Weight *" value={form.weight || ''} onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))} />
                <EmsSelect value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} placeholder="Unit" options={[{ value: 'MT', label: 'MT' }, { value: 'KG', label: 'KG' }]} />
              </div>
              <EmsSelect
                value={form.inwardTypeId}
                onChange={(v) => setForm((f) => ({ ...f, inwardTypeId: v }))}
                placeholder="Inward type *"
                options={[{ value: '', label: 'All types' }, ...(types || []).map((t: any) => ({ value: t.id, label: t.name }))]}
              />
              {selectedType?.requiresDesc && (
                <input className="ems-input w-full" placeholder="Specify other type *" value={form.otherTypeDesc} onChange={(e) => setForm((f) => ({ ...f, otherTypeDesc: e.target.value }))} />
              )}
              <EmsSelect
                value={form.locationId}
                onChange={(v) => setForm((f) => ({ ...f, locationId: v }))}
                placeholder="Receiving location *"
                options={[{ value: '', label: 'All locations' }, ...(locations || []).map((l: any) => ({ value: l.id, label: l.name }))]}
              />
              <input className="ems-input w-full" type="number" placeholder="Price (optional)" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
              <textarea className="ems-input w-full min-h-[60px]" placeholder="Remarks" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="ems-btn-secondary text-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="ems-btn-primary text-sm" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Submit Inward'}</button>
            </div>
          </div>
        </div>
      )}
    </ProductionShell>
  );
}
