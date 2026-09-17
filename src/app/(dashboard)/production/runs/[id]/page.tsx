'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [loadError, setLoadError] = useState('');
  const [cleaningTypes, setCleaningTypes] = useState<any[]>([]);
  const [hullingTypes, setHullingTypes] = useState<any[]>([]);
  const [cleanQty, setCleanQty] = useState<Record<string, number>>({});
  const [hullLines, setHullLines] = useState<Record<string, HullLine>>({});
  const [dispositions, setDispositions] = useState<Record<string, 'STORE' | 'DISCARD' | ''>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    inputDate: new Date().toISOString().slice(0, 10),
    stockCategory: 'NORMAL_RAW_MATERIAL',
    quantity: 0,
    unit: 'KG',
    remarks: '',
  });
  const role =
    typeof window !== 'undefined'
      ? (JSON.parse(localStorage.getItem('ems_user') || '{}').role as string)
      : '';

  async function load() {
    const [r, ct, ht] = await Promise.all([
      api.production.run(id),
      api.production.wastageTypes('CLEANING'),
      api.production.wastageTypes('HULLING'),
    ]);
    setRun(r);
    setCleaningTypes(ct);
    setHullingTypes(ht);
  }

  useEffect(() => {
    if (!id) return;
    setLoadError('');
    load().catch((e: unknown) => {
      setLoadError(e instanceof Error ? e.message : 'Failed to load production run');
    });
  }, [id]);

  const isSortex = run?.processType === 'SORTEX';
  const awaitingFinalise = run?.status === 'AWAITING_FINALISATION';

  const wastageBreakdown = useMemo(() => {
    if (!run) return [];
    const lines: { wastageTypeId: string; name: string; stage: string; quantityKg: number }[] = [];
    for (const c of run.cleaning || []) {
      if (c.quantityKg > 0) {
        lines.push({
          wastageTypeId: c.wastageTypeId,
          name: c.wastageType?.nameEn || c.wastageTypeId,
          stage: 'CLEANING',
          quantityKg: c.quantityKg,
        });
      }
    }
    for (const h of run.hulling || []) {
      if (h.quantityKg > 0) {
        lines.push({
          wastageTypeId: h.wastageTypeId,
          name: h.wastageType?.nameEn || h.wastageTypeId,
          stage: 'HULLING',
          quantityKg: h.quantityKg,
        });
      }
    }
    return lines;
  }, [run]);

  const totalWastageKg = wastageBreakdown.reduce((s, l) => s + l.quantityKg, 0);

  if (loadError) {
    return (
      <ProductionShell title="Production Run">
        <p className="text-sm text-rose-600">{loadError}</p>
        <Link href="/production/runs" className="mt-3 inline-block text-sm text-blue-600">
          Back to runs
        </Link>
      </ProductionShell>
    );
  }

  if (!run) {
    return (
      <ProductionShell title="Production Run">
        <p className="text-sm text-slate-500">Loading…</p>
      </ProductionShell>
    );
  }

  async function submitCleaning() {
    const msg = isSortex
      ? 'Finalize Sortex cleaning? You will then set Store/Discard and finalise production.'
      : 'Finalize cleaning? This moves stock to WIP Hulling.';
    if (!window.confirm(msg)) return;
    try {
      await api.production.cleaning(id, {
        lines: cleaningTypes.map((t) => ({
          wastageTypeId: t.id,
          quantity: cleanQty[t.id] || 0,
          unit: 'KG',
        })),
      });
      showSuccess('Cleaning finalized');
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Cleaning failed');
    }
  }

  async function submitHulling() {
    if (!window.confirm('Finalize hulling? Then set Store/Discard and finalise production.')) return;
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
      showSuccess('Hulling finalized');
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Hulling failed');
    }
  }

  async function finalise() {
    for (const line of wastageBreakdown) {
      if (!dispositions[line.wastageTypeId]) {
        showError(`Select Store or Discard for ${line.name}`);
        return;
      }
    }
    if (!window.confirm('Finalise production? Good output moves to Processed Inventory.')) return;
    try {
      await api.production.finalise(id, {
        dispositions: wastageBreakdown.map((l) => ({
          wastageTypeId: l.wastageTypeId,
          action: dispositions[l.wastageTypeId],
        })),
      });
      showSuccess('Production finalised — output in Processed Inventory');
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Finalise failed');
    }
  }

  async function addInput() {
    try {
      await api.production.addInput(id, {
        ...addForm,
        quantity: Number(addForm.quantity),
        unit: 'KG',
      });
      showSuccess('Input added');
      setAddOpen(false);
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Add input failed');
    }
  }

  async function reopenCleaning() {
    const reason = window.prompt('Reason for reopening cleaning?') || undefined;
    try {
      await api.production.reopenCleaning(id, { reason });
      showSuccess('Cleaning reopened');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Reopen failed');
    }
  }

  const showCleaning = !run.cleaningFinalizedAt;
  const showHulling = !isSortex && run.cleaningFinalizedAt && !run.hullingFinalizedAt;
  const showFinalise = awaitingFinalise || (run.cleaningFinalizedAt && (isSortex || run.hullingFinalizedAt) && !run.finalisedAt && run.status !== 'COMPLETED');

  return (
    <ProductionShell title={run.productionNumber} subtitle={`${run.product?.name} · ${run.processType?.replace(/_/g, ' ')}`}>
      <div className="mb-4">
        <Link href="/production/runs" className="text-sm text-blue-600 hover:underline">
          ← Back to runs
        </Link>
      </div>

      <div className="ems-card mb-4 grid gap-3 p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase text-slate-400">Plant</p>
          <p className="font-medium">{run.plant?.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Status</p>
          <p className="font-medium">{run.status?.replace(/_/g, ' ')}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Total Input</p>
          <p className="font-medium">{formatNumber(run.totalInputKg, 0)} KG</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Net Output</p>
          <p className="font-medium">{formatNumber(run.netOutputKg, 0)} KG</p>
        </div>
      </div>

      {showCleaning && (
        <div className="ems-card mb-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{isSortex ? 'Sortex / Cleaning (Type 2/3/4)' : 'Stage 1 — Cleaning'}</h3>
            {!run.cleaningFinalizedAt && (
              <button type="button" className="text-sm text-blue-600" onClick={() => setAddOpen(true)}>
                + Additional input
              </button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {cleaningTypes.map((t) => (
              <div key={t.id}>
                <label className="ems-label">{t.nameEn} (KG)</label>
                <input
                  className="ems-input w-full"
                  type="number"
                  step="0.001"
                  value={cleanQty[t.id] || ''}
                  onChange={(e) => setCleanQty((q) => ({ ...q, [t.id]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </div>
          <button type="button" className="ems-btn-primary mt-3 text-sm" onClick={submitCleaning}>
            Finalize Cleaning
          </button>
        </div>
      )}

      {showHulling && (
        <div className="ems-card mb-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Stage 2 — Hulling</h3>
            {['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(role) && (
              <button type="button" className="text-sm text-amber-700" onClick={reopenCleaning}>
                Reopen cleaning
              </button>
            )}
          </div>
          <p className="mb-2 text-sm text-slate-600">
            Hulling input: {formatNumber(run.hullingInputKg, 0)} KG
          </p>
          <div className="space-y-3">
            {hullingTypes.map((t) => (
              <div key={t.id} className="grid gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-4">
                <p className="text-sm font-medium sm:col-span-4">{t.nameEn}</p>
                <input
                  className="ems-input"
                  type="number"
                  placeholder="Bags"
                  value={hullLines[t.id]?.bags || ''}
                  onChange={(e) =>
                    setHullLines((h) => ({ ...h, [t.id]: { ...h[t.id], bags: Number(e.target.value) } }))
                  }
                />
                <input
                  className="ems-input"
                  type="number"
                  placeholder="Kg/bag"
                  value={hullLines[t.id]?.weightPerBag || ''}
                  onChange={(e) =>
                    setHullLines((h) => ({
                      ...h,
                      [t.id]: { ...h[t.id], weightPerBag: Number(e.target.value) },
                    }))
                  }
                />
                <input
                  className="ems-input sm:col-span-2"
                  type="number"
                  placeholder="Or direct KG"
                  value={hullLines[t.id]?.direct || ''}
                  onChange={(e) =>
                    setHullLines((h) => ({ ...h, [t.id]: { ...h[t.id], direct: Number(e.target.value) } }))
                  }
                />
              </div>
            ))}
          </div>
          <button type="button" className="ems-btn-primary mt-3 text-sm" onClick={submitHulling}>
            Finalize Hulling
          </button>
        </div>
      )}

      {showFinalise && (
        <div className="ems-card mb-4 p-4">
          <h3 className="mb-3 font-semibold">Production Finalisation</h3>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Production Number</p>
              <p className="font-medium">{run.productionNumber}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Total Input</p>
              <p className="font-medium">{formatNumber(run.totalInputKg, 0)} KG</p>
            </div>
            <div className="group relative rounded-lg bg-amber-50 p-3">
              <p className="text-xs text-amber-700">Total Wastage</p>
              <p className="font-medium text-amber-900">{formatNumber(totalWastageKg, 0)} KG</p>
              <div className="absolute left-0 top-full z-10 mt-1 hidden min-w-[200px] rounded-lg border bg-white p-2 text-xs shadow-lg group-hover:block">
                {wastageBreakdown.map((l) => (
                  <div key={l.wastageTypeId} className="flex justify-between gap-4 py-0.5">
                    <span>
                      {l.name} ({l.stage === 'CLEANING' ? 'Cleaning' : 'Hulling'})
                    </span>
                    <span>{formatNumber(l.quantityKg, 0)} KG</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">Net Processed Output</p>
              <p className="font-medium text-emerald-900">{formatNumber(run.netOutputKg, 0)} KG</p>
            </div>
          </div>

          <h4 className="mb-2 text-sm font-semibold">Wastage disposition (Store / Discard)</h4>
          {wastageBreakdown.length === 0 ? (
            <p className="mb-3 text-sm text-slate-500">No wastage recorded.</p>
          ) : (
            <table className="mb-3 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Wastage Type</th>
                  <th>Quantity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {wastageBreakdown.map((l) => (
                  <tr key={l.wastageTypeId} className="border-b border-slate-100">
                    <td className="py-2">{l.name}</td>
                    <td>{formatNumber(l.quantityKg, 0)} KG</td>
                    <td>
                      <select
                        className="ems-input"
                        value={dispositions[l.wastageTypeId] || ''}
                        onChange={(e) =>
                          setDispositions((d) => ({
                            ...d,
                            [l.wastageTypeId]: e.target.value as 'STORE' | 'DISCARD',
                          }))
                        }
                      >
                        <option value="">Select…</option>
                        <option value="STORE">Store</option>
                        <option value="DISCARD">Discard</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button type="button" className="ems-btn-primary text-sm" onClick={finalise}>
            Finalise Production
          </button>
        </div>
      )}

      {run.status === 'COMPLETED' && (
        <div className="ems-card p-4">
          <h3 className="mb-2 font-semibold">Completed</h3>
          <p className="text-sm text-slate-600">
            Finalised {run.finalisedAt ? formatDate(run.finalisedAt) : ''}. Good output is in Processed Inventory —
            allocate via Fulfilment.
          </p>
          {(run.outputLots || []).map((l: any) => (
            <p key={l.id} className="mt-1 text-sm">
              Lot {l.lotNumber}: {formatNumber(l.quantityKg, 0)} KG (available {formatNumber(l.availableKg, 0)} KG)
            </p>
          ))}
          {(run.allocations || []).length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="text-xs font-semibold uppercase text-slate-400">Historical allocations (read-only)</p>
              {(run.allocations || []).map((a: any) => (
                <p key={a.id} className="text-sm text-slate-600">
                  {formatNumber(a.quantityKg, 0)} KG → container {a.containerId?.slice(0, 8)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5">
            <h3 className="mb-3 font-semibold">Additional input (KG)</h3>
            <input
              className="ems-input mb-2 w-full"
              type="date"
              value={addForm.inputDate}
              onChange={(e) => setAddForm((f) => ({ ...f, inputDate: e.target.value }))}
            />
            <input
              className="ems-input mb-2 w-full"
              type="number"
              placeholder="Quantity KG"
              value={addForm.quantity || ''}
              onChange={(e) => setAddForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="ems-btn-secondary text-sm" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="button" className="ems-btn-primary text-sm" onClick={addInput}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </ProductionShell>
  );
}
