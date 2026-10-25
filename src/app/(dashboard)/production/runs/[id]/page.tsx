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
  const [actualCleanedOutputKg, setActualCleanedOutputKg] = useState<number | ''>('');
  const [hullLines, setHullLines] = useState<Record<string, HullLine>>({});
  const [actualProcessedOutputKg, setActualProcessedOutputKg] = useState<number | ''>('');
  const [dispositions, setDispositions] = useState<Record<string, 'STORE' | 'DISCARD' | ''>>({});
  const [matchingContainers, setMatchingContainers] = useState<any[]>([]);
  const [directAllocs, setDirectAllocs] = useState<Record<string, number>>({});
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
    const [r, ct, ht, prods] = await Promise.all([
      api.production.run(id),
      api.production.wastageTypes('CLEANING'),
      api.production.wastageTypes('HULLING'),
      api.masters.products(),
    ]);
    if (!r) {
      setLoadError('Production run not found');
      return;
    }
    setRun(r);
    setCleaningTypes(ct);
    setHullingTypes(ht);

    if (r.cleaningOutputKg != null) {
      setActualCleanedOutputKg(r.cleaningOutputKg);
    }
    if (r.netOutputKg != null) {
      setActualProcessedOutputKg(r.netOutputKg);
    }

    // Determine target product for direct fulfillment
    let targetProductId = r.productId;
    if (r.processType === 'HULLING_SORTEX' || r.processType === 'FULL_PROCESS') {
      const hss = (prods || []).find((p: any) => p.code === 'HSS' || (p.name || '').toLowerCase().includes('hulled sesame'));
      if (hss) targetProductId = hss.id;
    }

    if (targetProductId) {
      try {
        const mc = await api.production.matchingContainers(targetProductId);
        setMatchingContainers(mc || []);
      } catch {}
    }
  }

  useEffect(() => {
    if (!id) return;
    setLoadError('');
    load().catch((e: unknown) => {
      setLoadError(e instanceof Error ? e.message : 'Failed to load production run');
    });
  }, [id]);

  const isCleaningOnly = run?.processType === 'CLEANING';
  const isSortex = run?.processType === 'SORTEX';
  const isHullingSortex = run?.processType === 'HULLING_SORTEX' || run?.processType === 'FULL_PROCESS';
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

  useEffect(() => {
    if (wastageBreakdown.length > 0) {
      setDispositions((prev) => {
        const next = { ...prev };
        for (const l of wastageBreakdown) {
          if (!next[l.wastageTypeId]) next[l.wastageTypeId] = 'STORE';
        }
        return next;
      });
    }
  }, [wastageBreakdown]);

  const totalWastageKg = wastageBreakdown.reduce((s, l) => s + l.quantityKg, 0);

  // Stage 1 calculations
  const stage1Wastage = useMemo(
    () => Object.values(cleanQty).reduce((s, v) => s + (Number(v) || 0), 0),
    [cleanQty],
  );
  const stage1CleanedOut = Number(actualCleanedOutputKg) || 0;
  const stage1TotalAccounted = stage1CleanedOut + stage1Wastage;
  const stage1Diff = Math.round(((run?.totalInputKg || 0) - stage1TotalAccounted) * 1000) / 1000;
  const stage1DiffPct = run?.totalInputKg > 0 ? (stage1Diff / run.totalInputKg) * 100 : 0;

  // Stage 2 calculations
  const stage2Input = run?.cleaningOutputKg || run?.totalInputKg || 0;
  const stage2Wastage = useMemo(() => {
    return hullingTypes.reduce((s, t) => {
      const line = hullLines[t.id] || {};
      const bags = Number(line.bags) || 0;
      const wpb = Number(line.weightPerBag) || 0;
      const direct = Number(line.direct) || 0;
      return s + (bags > 0 && wpb > 0 ? bags * wpb : direct);
    }, 0);
  }, [hullingTypes, hullLines]);
  const stage2ProcessedOut = Number(actualProcessedOutputKg) || 0;
  const stage2TotalAccounted = stage2ProcessedOut + stage2Wastage;
  const stage2Diff = Math.round((stage2Input - stage2TotalAccounted) * 1000) / 1000;
  const overallDiff = Math.round(((run?.totalInputKg || 0) - (stage2ProcessedOut + (run?.cleaningWastageKg || 0) + stage2Wastage)) * 1000) / 1000;
  const overallDiffPct = run?.totalInputKg > 0 ? (overallDiff / run.totalInputKg) * 100 : 0;

  async function submitCleaning() {
    if (actualCleanedOutputKg === '' || Number(actualCleanedOutputKg) < 0) {
      showError('Please enter valid Actual Cleaned Output (KG)');
      return;
    }
    const msg = isCleaningOnly
      ? 'Finalize Cleaning? Output will be ready for finalization.'
      : 'Finalize Cleaning? Cleaned output moves to Stage 2 processing.';
    if (!window.confirm(msg)) return;
    try {
      await api.production.cleaning(id, {
        actualCleanedOutputKg: Number(actualCleanedOutputKg),
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
    if (actualProcessedOutputKg === '' || Number(actualProcessedOutputKg) < 0) {
      showError('Please enter valid Actual Processed Output (KG)');
      return;
    }
    if (!window.confirm('Finalize Stage 2? You will then review wastage and direct fulfillments.')) return;
    try {
      await api.production.hulling(id, {
        actualProcessedOutputKg: Number(actualProcessedOutputKg),
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
      showSuccess('Stage 2 finalized');
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Stage 2 finalization failed');
    }
  }

  async function finalise() {
    for (const line of wastageBreakdown) {
      if (!dispositions[line.wastageTypeId]) {
        showError(`Select Store or Discard for ${line.name}`);
        return;
      }
    }

    const directAllocationsList = Object.entries(directAllocs)
      .filter(([, qty]) => qty > 0)
      .map(([containerId, quantityKg]) => {
        const mc = matchingContainers.find((c) => c.containerId === containerId);
        return {
          contractId: mc?.contractId || '',
          containerId,
          quantityKg: Number(quantityKg),
          remarks: `Direct fulfillment from production run ${run?.productionNumber || ''}`,
        };
      });

    const totalAllocated = directAllocationsList.reduce((s, a) => s + a.quantityKg, 0);
    if (totalAllocated > (run?.netOutputKg || 0) + 0.001) {
      showError(`Allocated quantity (${totalAllocated} KG) exceeds net processed output (${run?.netOutputKg || 0} KG)`);
      return;
    }

    if (!window.confirm('Finalise production? Remaining output will be stored in Processed Inventory.')) return;
    try {
      await api.production.finalise(id, {
        dispositions: wastageBreakdown.map((l) => ({
          wastageTypeId: l.wastageTypeId,
          action: dispositions[l.wastageTypeId] || 'STORE',
        })),
        directAllocations: directAllocationsList.length > 0 ? directAllocationsList : undefined,
      });
      showSuccess('Production finalised — output allocated / stored');
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

  const showCleaning = !run?.cleaningFinalizedAt;
  const showHulling = !isCleaningOnly && run?.cleaningFinalizedAt && !run?.hullingFinalizedAt;
  const showFinalise = awaitingFinalise || (run?.cleaningFinalizedAt && (isCleaningOnly || run?.hullingFinalizedAt) && !run?.finalisedAt && run?.status !== 'COMPLETED');

  if (loadError) {
    return (
      <ProductionShell title="Production Run">
        <div className="mb-4">
          <Link href="/production/runs" className="text-sm text-blue-600 hover:underline">
            ← Back to runs
          </Link>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-semibold">Unable to load production run</p>
          <p className="text-sm text-red-600 mt-1">{loadError}</p>
        </div>
      </ProductionShell>
    );
  }

  if (!run) {
    return (
      <ProductionShell title="Production Run">
        <div className="mb-4">
          <Link href="/production/runs" className="text-sm text-blue-600 hover:underline">
            ← Back to runs
          </Link>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span>Loading production run details…</span>
        </div>
      </ProductionShell>
    );
  }

  return (
    <ProductionShell title={run.productionNumber || 'Production Run'} subtitle={`${run.product?.name || ''} · ${run.processType?.replace(/_/g, ' ') || ''}`}>
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
            <div>
              <h3 className="font-semibold text-slate-800">
                {isCleaningOnly ? 'Cleaning Process' : 'Stage 1 — Cleaning'}
              </h3>
              <p className="text-xs text-slate-500">Record actual cleaned output and cleaning wastage.</p>
            </div>
            {!run.cleaningFinalizedAt && (
              <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => setAddOpen(true)}>
                + Additional input
              </button>
            )}
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="ems-label font-semibold text-slate-800">Actual Cleaned Output (KG) *</label>
              <input
                className="ems-input w-full font-medium"
                type="number"
                step="0.001"
                min="0"
                placeholder="Enter weighed cleaned output (KG)"
                value={actualCleanedOutputKg}
                onChange={(e) => setActualCleanedOutputKg(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Stage 1 Wastage Lines</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {cleaningTypes.map((t) => (
              <div key={t.id}>
                <label className="ems-label">{t.nameEn} (KG)</label>
                <input
                  className="ems-input w-full"
                  type="number"
                  step="0.001"
                  min="0"
                  value={cleanQty[t.id] || ''}
                  onChange={(e) => setCleanQty((q) => ({ ...q, [t.id]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </div>

          {/* Stage 1 Real-time Reconciliation Card */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Stage 1 Weight Calculation</h4>
            <div className="grid gap-2 text-sm sm:grid-cols-4">
              <div>
                <span className="text-xs text-slate-500">Total Input</span>
                <p className="font-semibold text-slate-800">{formatNumber(run.totalInputKg, 0)} KG</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Cleaning Wastage</span>
                <p className="font-semibold text-amber-700">{formatNumber(stage1Wastage, 0)} KG</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Total Accounted Output</span>
                <p className="font-semibold text-emerald-700">{formatNumber(stage1TotalAccounted, 0)} KG</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Weight Difference</span>
                <p className={`font-semibold ${stage1DiffPct > 15 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {formatNumber(stage1Diff, 0)} KG ({stage1DiffPct.toFixed(1)}%)
                </p>
              </div>
            </div>
            {stage1DiffPct > 15 && (
              <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-2 text-xs font-semibold text-rose-800">
                ⚠️ High Unaccounted Difference Alert: Weight difference exceeds 15% threshold ({stage1DiffPct.toFixed(1)}%)!
              </div>
            )}
          </div>

          <button type="button" className="ems-btn-primary mt-4 text-sm" onClick={submitCleaning}>
            {isCleaningOnly ? 'Finalize Cleaning → Move to Finalisation' : 'Finalize Cleaning → Move to Stage 2'}
          </button>
        </div>
      )}

      {showHulling && (
        <div className="ems-card mb-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">
                {isSortex ? 'Stage 2 — Sortex' : 'Stage 2 — Hulling + Sortex'}
              </h3>
              <p className="text-xs text-slate-500">
                Stage 2 Input (from Stage 1 Cleaned Output): <span className="font-semibold">{formatNumber(stage2Input, 0)} KG</span>
              </p>
            </div>
            {['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(role) && (
              <button type="button" className="text-sm text-amber-700 hover:underline" onClick={reopenCleaning}>
                Reopen cleaning
              </button>
            )}
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="ems-label font-semibold text-slate-800">Actual Processed Output (KG) *</label>
              <input
                className="ems-input w-full font-medium"
                type="number"
                step="0.001"
                min="0"
                placeholder="Enter final weighed processed output (KG)"
                value={actualProcessedOutputKg}
                onChange={(e) => setActualProcessedOutputKg(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Stage 2 Wastage Lines</p>
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

          {/* Stage 2 Real-time Reconciliation Card */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Stage 2 & Overall Weight Calculation</h4>
            <div className="grid gap-2 text-sm sm:grid-cols-4">
              <div>
                <span className="text-xs text-slate-500">Stage 2 Input</span>
                <p className="font-semibold text-slate-800">{formatNumber(stage2Input, 0)} KG</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Stage 2 Wastage</span>
                <p className="font-semibold text-amber-700">{formatNumber(stage2Wastage, 0)} KG</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Actual Processed Output</span>
                <p className="font-semibold text-emerald-700">{formatNumber(stage2ProcessedOut, 0)} KG</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Overall Weight Difference</span>
                <p className={`font-semibold ${overallDiffPct > 15 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {formatNumber(overallDiff, 0)} KG ({overallDiffPct.toFixed(1)}%)
                </p>
              </div>
            </div>
            {overallDiffPct > 15 && (
              <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-2 text-xs font-semibold text-rose-800">
                ⚠️ High Wastage Alert: Overall weight difference exceeds 15% threshold ({overallDiffPct.toFixed(1)}%)!
              </div>
            )}
          </div>

          <button type="button" className="ems-btn-primary mt-4 text-sm" onClick={submitHulling}>
            Finalize Stage 2 → Move to Finalisation
          </button>
        </div>
      )}

      {showFinalise && (
        <div className="ems-card mb-4 p-4">
          <h3 className="mb-3 font-semibold text-slate-800">Production Finalisation</h3>

          {isHullingSortex && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <span className="font-semibold">Automatic Product Conversion:</span> Natural Sesame Seeds will automatically convert to <span className="font-bold underline">Hulled Sesame Seeds (HSS)</span> upon finalization.
            </div>
          )}

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

          <h4 className="mb-2 text-sm font-semibold">1. Wastage Disposition (Default: Store in Plant Inventory)</h4>
          {wastageBreakdown.length === 0 ? (
            <p className="mb-3 text-sm text-slate-500">No wastage recorded.</p>
          ) : (
            <table className="mb-4 w-full text-sm">
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
                        value={dispositions[l.wastageTypeId] || 'STORE'}
                        onChange={(e) =>
                          setDispositions((d) => ({
                            ...d,
                            [l.wastageTypeId]: e.target.value as 'STORE' | 'DISCARD',
                          }))
                        }
                      >
                        <option value="STORE">Store in Plant Wastage Inventory</option>
                        <option value="DISCARD">Discard</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Direct Fulfillment Section (§9) */}
          <div className="mb-4 border-t border-slate-200 pt-4">
            <h4 className="mb-1 text-sm font-semibold text-slate-800">2. Direct Fulfillment to Contract Containers (Optional)</h4>
            <p className="mb-3 text-xs text-slate-500">
              Allocate a portion of good output directly to pending contract containers matching this product. Check packaging specifications before allocating. Remaining output will be stored in Processed Inventory.
            </p>

            {matchingContainers.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                No open contract containers currently awaiting fulfillment for this product. 100% of output will go to Processed Inventory.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-slate-600">
                      <th className="p-2">Contract</th>
                      <th className="p-2">Buyer</th>
                      <th className="p-2">Container</th>
                      <th className="p-2">Packaging Info</th>
                      <th className="p-2">Due Date</th>
                      <th className="p-2">Pending (KG)</th>
                      <th className="p-2">Allocate (KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchingContainers.map((mc: any) => {
                      const totalPending = (mc.productLines || []).reduce((s: number, l: any) => s + (l.pendingKg || 0), 0);
                      const packDesc = [mc.packagingType, mc.packagingSize, mc.packingDescription].filter(Boolean).join(' · ');
                      return (
                        <tr key={mc.containerId} className="border-b border-slate-100">
                          <td className="p-2 font-semibold text-blue-600">{mc.contractNumber}</td>
                          <td className="p-2">{mc.buyer?.name || '—'}</td>
                          <td className="p-2 font-medium">C#{mc.containerIndex}</td>
                          <td className="p-2">
                            <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                              {packDesc || 'Standard'}
                            </span>
                          </td>
                          <td className="p-2 text-slate-600">{formatDate(mc.expectedShipmentDate)}</td>
                          <td className="p-2 font-semibold">{formatNumber(totalPending, 0)} KG</td>
                          <td className="p-2">
                            <input
                              className="ems-input w-28 text-xs font-medium"
                              type="number"
                              min="0"
                              max={totalPending}
                              placeholder="0 KG"
                              value={directAllocs[mc.containerId] || ''}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setDirectAllocs((prev) => ({
                                  ...prev,
                                  [mc.containerId]: Math.min(val, totalPending),
                                }));
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {matchingContainers.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-600">
                <div>
                  Total Allocated to Containers:{' '}
                  <span className="font-semibold text-blue-600">
                    {formatNumber(Object.values(directAllocs).reduce((s, v) => s + (Number(v) || 0), 0), 0)} KG
                  </span>
                </div>
                <div>
                  Remaining to Processed Inventory:{' '}
                  <span className="font-semibold text-emerald-600">
                    {formatNumber(
                      Math.max(
                        0,
                        (run.netOutputKg || 0) - Object.values(directAllocs).reduce((s, v) => s + (Number(v) || 0), 0),
                      ),
                      0,
                    )}{' '}
                    KG
                  </span>
                </div>
              </div>
            )}
          </div>

          <button type="button" className="ems-btn-primary text-sm" onClick={finalise}>
            Finalise Production & Store Remaining
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
