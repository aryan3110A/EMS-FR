'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ProductionShell } from '@/components/production/production-shell';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

type HullLine = { bags?: number; weightPerBag?: number; direct?: number };

export default function ProductionRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<any>(null);
  const [cleaningTypes, setCleaningTypes] = useState<any[]>([]);
  const [hullingTypes, setHullingTypes] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [cleanQty, setCleanQty] = useState<Record<string, number>>({});
  const [hullLines, setHullLines] = useState<Record<string, HullLine>>({});
  const [alloc, setAlloc] = useState({
    contractId: '',
    containerId: '',
    productId: '',
    containerProductId: '',
    quantity: 0,
    unit: 'MT',
  });
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    inputDate: new Date().toISOString().slice(0, 10),
    stockCategory: 'NORMAL_RAW_MATERIAL',
    quantity: 0,
    unit: 'MT',
    remarks: '',
  });
  const role =
    typeof window !== 'undefined'
      ? (JSON.parse(localStorage.getItem('ems_user') || '{}').role as string)
      : '';

  async function load() {
    const [r, ct, ht, p] = await Promise.all([
      api.production.run(id),
      api.production.wastageTypes('CLEANING'),
      api.production.wastageTypes('HULLING'),
      api.production.pendingContracts(),
    ]);
    setRun(r);
    setCleaningTypes(ct);
    setHullingTypes(ht);
    setPending(p);
  }

  useEffect(() => {
    if (id) load().catch(console.error);
  }, [id]);

  if (!run) {
    return (
      <ProductionShell title="Production Run">
        <p className="text-sm text-slate-500">Loading…</p>
      </ProductionShell>
    );
  }

  const remaining = Math.max(0, (run.netOutputKg || 0) - (run.allocatedKg || 0) - (run.storedProcessedKg || 0));

  async function submitCleaning() {
    if (!window.confirm('Finalize cleaning? This moves stock to WIP Hulling.')) return;
    try {
      await api.production.cleaning(id, {
        lines: cleaningTypes.map((t) => ({ wastageTypeId: t.id, quantity: cleanQty[t.id] || 0, unit: 'KG' })),
      });
      showSuccess('Cleaning finalized');
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Cleaning failed');
    }
  }

  async function submitHulling() {
    if (!window.confirm('Finalize hulling? Net output will be calculated and locked for allocation.')) return;
    try {
      await api.production.hulling(id, {
        lines: hullingTypes.map((t) => {
          const line = hullLines[t.id] || {};
          const bags = Number(line.bags) || 0;
          const wpb = Number(line.weightPerBag) || 0;
          const direct = Number(line.direct) || 0;
          const qty = bags > 0 && wpb > 0 ? bags * wpb : direct;
          return {
            wastageTypeId: t.id,
            quantity: qty,
            unit: 'KG',
            numberOfBags: bags || undefined,
            weightPerBag: wpb || undefined,
          };
        }),
      });
      showSuccess('Hulling finalized — net output ready');
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Hulling failed');
    }
  }

  async function doAllocate() {
    if (!window.confirm('Allocate this quantity to the selected container?')) return;
    try {
      await api.production.allocate(id, {
        ...alloc,
        quantity: Number(alloc.quantity),
        containerProductId: alloc.containerProductId || undefined,
      });
      showSuccess('Allocated to container');
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Allocation failed');
    }
  }

  async function storeRemaining() {
    if (!window.confirm('Store remaining quantity in processed inventory?')) return;
    try {
      await api.production.storeProcessed(id);
      showSuccess('Remaining quantity stored in processed inventory');
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Store failed');
    }
  }

  async function addMoreInput() {
    try {
      await api.production.addInput(id, {
        ...addForm,
        quantity: Number(addForm.quantity),
      });
      showSuccess('Additional input added');
      setAddOpen(false);
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Add input failed');
    }
  }

  async function reopenCleaning() {
    const reason = window.prompt('Admin reopen reason (required):');
    if (!reason?.trim()) return;
    try {
      await api.production.reopenCleaning(id, { reason });
      showSuccess('Cleaning reopened');
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Reopen failed');
    }
  }

  const selectedContract = pending.find((c) => c.id === alloc.contractId);
  const selectedContainer = selectedContract?.containers?.find((ct: any) => ct.id === alloc.containerId);

  return (
    <ProductionShell title={run.productionNumber} subtitle={`${run.product?.name} · ${run.status?.replace(/_/g, ' ')}`}>
      <Link href="/production/runs" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        ← Back to runs
      </Link>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="ems-card p-4">
          <p className="text-xs text-slate-500">Input</p>
          <p className="text-xl font-bold">{formatNumber(run.totalInputKg / 1000, 3)} MT</p>
        </div>
        <div className="ems-card p-4">
          <p className="text-xs text-slate-500">Net output</p>
          <p className="text-xl font-bold">{formatNumber(run.netOutputKg / 1000, 3)} MT</p>
        </div>
        <div className="ems-card p-4">
          <p className="text-xs text-slate-500">Allocated</p>
          <p className="text-xl font-bold">{formatNumber(run.allocatedKg / 1000, 3)} MT</p>
        </div>
        <div className="ems-card p-4">
          <p className="text-xs text-slate-500">Remaining</p>
          <p className="text-xl font-bold">{formatNumber(remaining / 1000, 3)} MT</p>
        </div>
      </div>

      <div className="ems-card mb-4 p-4 text-sm">
        <p>
          Plant: {run.plant?.name} · Process: {run.processType?.replace(/_/g, ' ')} · Started {formatDate(run.startDate)}
          {run.daysSpanned ? ` · ${run.daysSpanned} day(s)` : ''}
        </p>
        {run.wastageAlert && <p className="mt-1 font-semibold text-rose-600">Wastage alert: {run.hullingWastagePct}%</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="font-medium">Inputs</p>
          {!run.cleaningFinalizedAt && (
            <button type="button" className="ems-btn-secondary text-xs" onClick={() => setAddOpen(true)}>
              Add More Input
            </button>
          )}
          {run.cleaningFinalizedAt && !run.hullingFinalizedAt && ['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(role) && (
            <button type="button" className="ems-btn-secondary text-xs" onClick={reopenCleaning}>
              Admin: Reopen Cleaning
            </button>
          )}
        </div>
        <ul className="mt-1 space-y-1">
          {run.inputs?.map((i: any) => (
            <li key={i.id}>
              {formatDate(i.inputDate)}: {formatNumber(i.quantityKg / 1000, 3)} MT {i.isAdditional ? '(additional)' : '(initial)'}
              {i.remarks ? ` — ${i.remarks}` : ''}
            </li>
          ))}
        </ul>
      </div>

      {!run.cleaningFinalizedAt && (
        <div className="ems-card mb-4 p-4">
          <h3 className="mb-3 font-semibold">Enter Cleaning Result</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {cleaningTypes.map((t) => (
              <label key={t.id} className="text-sm">
                {t.nameEn}
                {t.nameLocal ? ` / ${t.nameLocal}` : ''} (kg)
                <input
                  className="ems-input mt-1 w-full"
                  type="number"
                  step="0.001"
                  value={cleanQty[t.id] || ''}
                  onChange={(e) => setCleanQty((q) => ({ ...q, [t.id]: Number(e.target.value) }))}
                />
              </label>
            ))}
          </div>
          <button type="button" className="ems-btn-primary mt-3 text-sm" onClick={submitCleaning}>
            Finalize Cleaning
          </button>
        </div>
      )}

      {run.cleaningFinalizedAt && !run.hullingFinalizedAt && (
        <div className="ems-card mb-4 p-4">
          <h3 className="mb-3 font-semibold">Enter Hulling / Haulding Result</h3>
          <p className="mb-2 text-sm text-slate-600">Hulling input: {formatNumber(run.hullingInputKg / 1000, 3)} MT</p>
          <div className="space-y-3">
            {hullingTypes.map((t) => {
              const line = hullLines[t.id] || {};
              const calc =
                Number(line.bags) > 0 && Number(line.weightPerBag) > 0
                  ? Number(line.bags) * Number(line.weightPerBag)
                  : Number(line.direct) || 0;
              return (
                <div key={t.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-medium">
                    {t.nameEn}
                    {t.nameLocal ? ` / ${t.nameLocal}` : ''}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <label className="text-xs">
                      Bags
                      <input
                        className="ems-input mt-1 w-full"
                        type="number"
                        value={line.bags || ''}
                        onChange={(e) =>
                          setHullLines((h) => ({ ...h, [t.id]: { ...h[t.id], bags: Number(e.target.value), direct: undefined } }))
                        }
                      />
                    </label>
                    <label className="text-xs">
                      Kg / bag
                      <input
                        className="ems-input mt-1 w-full"
                        type="number"
                        step="0.001"
                        value={line.weightPerBag || ''}
                        onChange={(e) =>
                          setHullLines((h) => ({
                            ...h,
                            [t.id]: { ...h[t.id], weightPerBag: Number(e.target.value), direct: undefined },
                          }))
                        }
                      />
                    </label>
                    <label className="text-xs">
                      Or direct kg
                      <input
                        className="ems-input mt-1 w-full"
                        type="number"
                        step="0.001"
                        value={line.direct || ''}
                        onChange={(e) =>
                          setHullLines((h) => ({
                            ...h,
                            [t.id]: { bags: undefined, weightPerBag: undefined, direct: Number(e.target.value) },
                          }))
                        }
                      />
                    </label>
                    <div className="text-xs">
                      Calculated
                      <p className="mt-2 font-semibold">{formatNumber(calc, 2)} kg</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" className="ems-btn-primary mt-3 text-sm" onClick={submitHulling}>
            Finalize Hulling
          </button>
        </div>
      )}

      {run.hullingFinalizedAt && remaining > 0.001 && (
        <div className="ems-card mb-4 p-4">
          <h3 className="mb-3 font-semibold">Allocate to Containers</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="ems-input"
              value={alloc.contractId}
              onChange={(e) =>
                setAlloc((a) => ({ ...a, contractId: e.target.value, containerId: '', productId: '', containerProductId: '' }))
              }
            >
              <option value="">Select contract</option>
              {pending.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractNumber} — {c.buyer?.name}
                </option>
              ))}
            </select>
            <select
              className="ems-input"
              value={alloc.containerId}
              onChange={(e) => setAlloc((a) => ({ ...a, containerId: e.target.value, productId: '', containerProductId: '' }))}
            >
              <option value="">Select container</option>
              {(selectedContract?.containers || []).map((ct: any) => (
                <option key={ct.id} value={ct.id}>
                  Container {ct.containerIndex} · pending {formatNumber(ct.pendingMt, 3)} MT
                </option>
              ))}
            </select>
            <select
              className="ems-input"
              value={alloc.containerProductId || alloc.productId}
              onChange={(e) => {
                const line = selectedContainer?.productLines?.find((p: any) => (p.id || p.productId) === e.target.value);
                setAlloc((a) => ({ ...a, productId: line?.productId || '', containerProductId: line?.id || '' }));
              }}
            >
              <option value="">Select product line</option>
              {(selectedContainer?.productLines || []).map((p: any) => (
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
              value={alloc.quantity || ''}
              onChange={(e) => setAlloc((a) => ({ ...a, quantity: Number(e.target.value), unit: 'MT' }))}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="ems-btn-primary text-sm" onClick={doAllocate}>
              Allocate to Container
            </button>
            <button type="button" className="ems-btn-secondary text-sm" onClick={storeRemaining}>
              Store Remaining in Processed Inventory
            </button>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Add More Input</h3>
            <div className="space-y-3">
              <input
                className="ems-input w-full"
                type="date"
                value={addForm.inputDate}
                onChange={(e) => setAddForm((f) => ({ ...f, inputDate: e.target.value }))}
              />
              <input
                className="ems-input w-full"
                type="number"
                step="0.001"
                placeholder="Quantity MT"
                value={addForm.quantity || ''}
                onChange={(e) => setAddForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
              />
              <textarea
                className="ems-input w-full min-h-[60px]"
                placeholder="Reason / remarks"
                value={addForm.remarks}
                onChange={(e) => setAddForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="ems-btn-secondary text-sm" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="button" className="ems-btn-primary text-sm" onClick={addMoreInput}>
                Add Input
              </button>
            </div>
          </div>
        </div>
      )}
    </ProductionShell>
  );
}
