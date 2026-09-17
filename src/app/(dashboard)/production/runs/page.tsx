'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { EmsSelect } from '@/components/ui/ems-select';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

function ProductionRunsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'IN_HOUSE' | 'JOB_WORK' | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    processType: 'SORTEX',
    plantId: '',
    productId: '',
    supplierId: '',
    stockCategory: 'NORMAL_RAW_MATERIAL',
    wastageLotId: '',
    rejectedLotId: '',
    quantity: 0,
    unit: 'KG',
    startDate: new Date().toISOString().slice(0, 10),
    remarks: '',
  });

  const { data: runs, loading: runsLoading } = useCachedQuery('production:runs', () => api.production.runs(), {
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
  const { data: balances } = useCachedQuery(
    form.plantId ? `production:balances:${form.plantId}` : 'production:balances:none',
    () =>
      form.plantId
        ? api.production.balances({ locationId: form.plantId, stockCategory: 'RAW_MATERIAL' })
        : Promise.resolve([]),
    { ttl: PRODUCTION_CACHE_TTL, enabled: !!form.plantId },
  );
  const { data: wastageLots } = useCachedQuery('production:wastage-lots', () => api.production.wastageLots(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: rejectedLots } = useCachedQuery('production:rejected-lots', () => api.production.rejectedLots(), {
    ttl: PRODUCTION_CACHE_TTL,
  });

  const selectedProduct = useMemo(
    () => (products || []).find((p: any) => p.id === form.productId),
    [products, form.productId],
  );

  const rawAtPlant = useMemo(() => {
    const rows = (balances || []) as any[];
    return rows.map((b) => ({
      productId: b.productId,
      name: b.product?.name || b.productId,
      availableKg: b.quantityKg || 0,
    }));
  }, [balances]);

  const availableForProduct = useMemo(() => {
    if (form.stockCategory === 'WASTAGE_INVENTORY' && form.wastageLotId) {
      const lot = (wastageLots || []).find((l: any) => l.id === form.wastageLotId);
      return lot?.availableKg || 0;
    }
    if (form.stockCategory === 'SAMPLE_REJECTED_STOCK' && form.rejectedLotId) {
      const lot = (rejectedLots || []).find((l: any) => l.id === form.rejectedLotId);
      return lot?.remainingKg ?? lot?.quantityKg ?? 0;
    }
    return rawAtPlant.find((r) => r.productId === form.productId)?.availableKg || 0;
  }, [rawAtPlant, form.productId, form.stockCategory, form.wastageLotId, form.rejectedLotId, wastageLots, rejectedLots]);

  const processOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    if (selectedProduct?.allowsSortex !== false) {
      opts.push({ value: 'SORTEX', label: 'Sortex' });
    }
    if (selectedProduct?.allowsFullProcess !== false) {
      opts.unshift({ value: 'FULL_PROCESS', label: 'Full Process' });
    }
    if (!opts.length) {
      opts.push({ value: 'SORTEX', label: 'Sortex' });
    }
    return opts;
  }, [selectedProduct]);

  useEffect(() => {
    if (!selectedProduct) return;
    if (form.processType === 'FULL_PROCESS' && selectedProduct.allowsFullProcess === false) {
      setForm((f) => ({
        ...f,
        processType: selectedProduct.allowsSortex === false ? 'FULL_PROCESS' : 'SORTEX',
      }));
    } else if (form.processType === 'SORTEX' && selectedProduct.allowsSortex === false) {
      setForm((f) => ({
        ...f,
        processType: selectedProduct.allowsFullProcess === false ? 'SORTEX' : 'FULL_PROCESS',
      }));
    }
  }, [selectedProduct, form.processType]);

  async function start() {
    if (!form.plantId || !form.productId || !form.quantity) {
      showError('Plant, product and quantity are required');
      return;
    }
    if (form.stockCategory === 'WASTAGE_INVENTORY' && !form.wastageLotId) {
      showError('Select a wastage lot');
      return;
    }
    if (form.stockCategory === 'SAMPLE_REJECTED_STOCK' && !form.rejectedLotId) {
      showError('Select a sampling-rejected lot');
      return;
    }
    if (
      ['NORMAL_RAW_MATERIAL', 'WASTAGE_INVENTORY', 'SAMPLE_REJECTED_STOCK'].includes(form.stockCategory) &&
      form.quantity > availableForProduct + 0.001
    ) {
      showError(`Available: ${formatNumber(availableForProduct, 0)} KG`);
      return;
    }
    setSaving(true);
    try {
      const created = await api.production.startRun({
        ...form,
        quantity: Number(form.quantity),
        unit: 'KG',
        supplierId: form.supplierId || undefined,
        wastageLotId: form.wastageLotId || undefined,
        rejectedLotId: form.rejectedLotId || undefined,
      });
      showSuccess(`Production ${created.productionNumber} started`);
      setOpen(false);
      setMode(null);
      invalidateQueryCache('production:');
      window.location.href = `/production/runs/${created.id}`;
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Failed to start production');
    } finally {
      setSaving(false);
    }
  }

  function openNew() {
    setMode(null);
    setOpen(true);
  }

  function closeNew() {
    setOpen(false);
    setMode(null);
    if (searchParams.get('new') === '1') router.replace('/production/runs');
  }

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setMode(null);
      setOpen(true);
    }
  }, [searchParams]);

  return (
    <ProductionShell title="Production Runs" subtitle="In-House processing → Processed Inventory (fulfilment is separate)">
      <div className="mb-4 flex justify-end">
        <button type="button" className="ems-btn-primary text-sm" onClick={openNew}>
          New Run
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
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <div>Input: {formatNumber(r.totalInputKg, 0)} KG</div>
              <div>Net output: {formatNumber(r.netOutputKg, 0)} KG</div>
              <div>Wastage: {formatNumber((r.cleaningWastageKg || 0) + (r.hullingWastageKg || 0), 0)} KG</div>
            </div>
          </Link>
        ))}
        {runsLoading && !runs?.length && <p className="text-sm text-slate-400">Loading…</p>}
        {!runsLoading && !runs?.length && <p className="text-sm text-slate-400">No production runs yet</p>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            {!mode ? (
              <>
                <h3 className="mb-3 text-lg font-semibold">Processing Mode</h3>
                <p className="mb-4 text-sm text-slate-600">Where is this production happening?</p>
                <div className="grid gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 p-4 text-left hover:border-blue-400 hover:bg-blue-50"
                    onClick={() => setMode('IN_HOUSE')}
                  >
                    <p className="font-semibold">In-House</p>
                    <p className="text-sm text-slate-500">Continue to normal Production Run</p>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 p-4 text-left hover:border-blue-400 hover:bg-blue-50"
                    onClick={() => {
                      closeNew();
                      router.push('/production/job-work/new');
                    }}
                  >
                    <p className="font-semibold">Job Work</p>
                    <p className="text-sm text-slate-500">Send material outside for processing</p>
                  </button>
                </div>
                <div className="mt-4 flex justify-end">
                  <button type="button" className="ems-btn-secondary text-sm" onClick={closeNew}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="mb-3 text-lg font-semibold">Start In-House Production</h3>
                <div className="space-y-3">
                  <EmsSelect
                    value={form.plantId}
                    onChange={(v) => setForm((f) => ({ ...f, plantId: v, productId: '' }))}
                    placeholder="Plant / Location *"
                    options={[
                      { value: '', label: 'Select location' },
                      ...(locations || []).map((l: any) => ({ value: l.id, label: l.name })),
                    ]}
                  />
                  {form.plantId && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p className="mb-1 font-medium text-slate-700">Available Raw Material</p>
                      {rawAtPlant.length ? (
                        <ul className="space-y-1">
                          {rawAtPlant.map((r) => (
                            <li key={r.productId} className="flex justify-between">
                              <span>{r.name}</span>
                              <span className="font-medium tabular-nums">{formatNumber(r.availableKg, 0)} KG</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-500">No raw material at this location</p>
                      )}
                    </div>
                  )}
                  <EmsSelect
                    value={form.productId}
                    onChange={(v) => setForm((f) => ({ ...f, productId: v }))}
                    placeholder="Product *"
                    options={[
                      { value: '', label: 'Select product' },
                      ...(products || []).map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
                    ]}
                    searchable
                  />
                  {form.productId && form.stockCategory === 'NORMAL_RAW_MATERIAL' && (
                    <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
                      Available at selected location: {formatNumber(availableForProduct, 0)} KG
                    </p>
                  )}
                  <EmsSelect
                    value={form.processType}
                    onChange={(v) => setForm((f) => ({ ...f, processType: v }))}
                    placeholder="Process type"
                    options={processOptions}
                  />
                  {selectedProduct && selectedProduct.allowsFullProcess === false && (
                    <p className="text-xs text-amber-700">
                      Full Process is currently available only for Sesame Seed products.
                    </p>
                  )}
                  {selectedProduct && selectedProduct.allowsSortex === false && (
                    <p className="text-xs text-amber-700">Sortex is not enabled for this product.</p>
                  )}
                  <EmsSelect
                    value={form.stockCategory}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, stockCategory: v, wastageLotId: '', rejectedLotId: '' }))
                    }
                    placeholder="Input source"
                    options={[
                      { value: 'NORMAL_RAW_MATERIAL', label: 'Raw Material' },
                      { value: 'EXISTING_PROCESSED_STOCK', label: 'Eligible Processed Stock' },
                      { value: 'WASTAGE_INVENTORY', label: 'Wastage Inventory (Sortex)' },
                      { value: 'SAMPLE_REJECTED_STOCK', label: 'Sampling-Rejected Stock (Sortex)' },
                    ]}
                  />
                  {form.stockCategory === 'WASTAGE_INVENTORY' && (
                    <EmsSelect
                      value={form.wastageLotId}
                      onChange={(v) => {
                        const lot = (wastageLots || []).find((l: any) => l.id === v);
                        setForm((f) => ({
                          ...f,
                          wastageLotId: v,
                          productId: lot?.productId || f.productId,
                          plantId: lot?.locationId || f.plantId,
                          processType: 'SORTEX',
                        }));
                      }}
                      placeholder="Wastage lot *"
                      options={[
                        { value: '', label: 'Select wastage lot' },
                        ...(wastageLots || []).map((l: any) => ({
                          value: l.id,
                          label: `${l.lotNumber} · ${l.wastageType?.nameEn} · ${formatNumber(l.availableKg, 0)} KG`,
                        })),
                      ]}
                    />
                  )}
                  {form.stockCategory === 'SAMPLE_REJECTED_STOCK' && (
                    <EmsSelect
                      value={form.rejectedLotId}
                      onChange={(v) => {
                        const lot = (rejectedLots || []).find((l: any) => l.id === v);
                        setForm((f) => ({
                          ...f,
                          rejectedLotId: v,
                          productId: lot?.productId || f.productId,
                          plantId: lot?.locationId || lot?.plantId || f.plantId,
                          processType: 'SORTEX',
                        }));
                      }}
                      placeholder="Sampling-rejected lot *"
                      options={[
                        { value: '', label: 'Select rejected lot' },
                        ...(rejectedLots || []).map((l: any) => ({
                          value: l.id,
                          label: `${l.lotNumber || l.id.slice(0, 8)} · ${formatNumber(l.remainingKg ?? l.quantityKg ?? 0, 0)} KG`,
                        })),
                      ]}
                    />
                  )}
                  {(form.stockCategory === 'WASTAGE_INVENTORY' || form.stockCategory === 'SAMPLE_REJECTED_STOCK') && (
                    <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
                      Available for this source: {formatNumber(availableForProduct, 0)} KG
                    </p>
                  )}
                  <EmsSelect
                    value={form.supplierId}
                    onChange={(v) => setForm((f) => ({ ...f, supplierId: v }))}
                    placeholder="Source party (optional)"
                    options={[
                      { value: '', label: 'No party' },
                      ...(suppliers || []).map((s: any) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                  <div>
                    <label className="ems-label">Quantity (KG)</label>
                    <input
                      className="ems-input w-full"
                      type="number"
                      step="0.001"
                      value={form.quantity || ''}
                      onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                    />
                  </div>
                  <input
                    className="ems-input w-full"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                  <textarea
                    className="ems-input w-full min-h-[60px]"
                    placeholder="Remarks"
                    value={form.remarks}
                    onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className="ems-btn-secondary text-sm" onClick={() => setMode(null)}>
                    Back
                  </button>
                  <button type="button" className="ems-btn-primary text-sm" disabled={saving} onClick={start}>
                    {saving ? 'Starting…' : 'Start Production'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </ProductionShell>
  );
}

export default function ProductionRunsPageRoute() {
  return (
    <Suspense
      fallback={
        <ProductionShell title="Production Runs" subtitle="In-House processing → Processed Inventory (fulfilment is separate)">
          <p className="text-sm text-slate-400">Loading…</p>
        </ProductionShell>
      }
    >
      <ProductionRunsPage />
    </Suspense>
  );
}
