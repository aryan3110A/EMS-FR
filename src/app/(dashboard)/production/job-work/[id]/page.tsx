'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { EmsSelect } from '@/components/ui/ems-select';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

export default function JobWorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [jw, setJw] = useState<any>(null);
  const [outward, setOutward] = useState({
    outwardDate: new Date().toISOString().slice(0, 10),
    quantity: 0,
    truckNumber: '',
    challanNumber: '',
    remarks: '',
  });
  const [inward, setInward] = useState({
    receiptDate: new Date().toISOString().slice(0, 10),
    receivingLocationId: '',
    truckNumber: '',
    lines: [{ returnCategory: 'PROCESSED', wastageTypeId: '', quantity: 0 }],
  });
  const [resultOpen, setResultOpen] = useState(false);
  const [cleanQty, setCleanQty] = useState<Record<string, number>>({});
  const [hullQty, setHullQty] = useState<Record<string, number>>({});
  const [disp, setDisp] = useState<Record<string, string>>({});
  const [processedInput, setProcessedInput] = useState(0);

  const { data: locations } = useCachedQuery('production:locations', () => api.production.locations(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: cleaningTypes } = useCachedQuery('wt:clean', () => api.production.wastageTypes('CLEANING'), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: hullingTypes } = useCachedQuery('wt:hull', () => api.production.wastageTypes('HULLING'), {
    ttl: PRODUCTION_CACHE_TTL,
  });

  async function load() {
    const data = await api.production.jobWork.get(id);
    setJw(data);
    setProcessedInput(data.totalSentKg || 0);
  }

  useEffect(() => {
    if (id) load().catch(console.error);
  }, [id]);

  if (!jw) {
    return (
      <ProductionShell title="Job Work">
        <p className="text-sm text-slate-500">Loading…</p>
      </ProductionShell>
    );
  }

  const recon = jw.reconciliation || {};
  const availableReSortex = (jw.processedLots || []).reduce(
    (s: number, l: any) => s + (l.availableKg || 0),
    0,
  );

  async function addOutward() {
    try {
      await api.production.jobWork.outward(id, { ...outward, quantity: Number(outward.quantity), unit: 'KG' });
      showSuccess('Outward recorded');
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Outward failed');
    }
  }

  async function addInward() {
    try {
      await api.production.jobWork.inward(id, {
        ...inward,
        lines: inward.lines.map((l) => ({
          ...l,
          quantity: Number(l.quantity),
          unit: 'KG',
          wastageTypeId: l.wastageTypeId || undefined,
        })),
      });
      showSuccess('Return receipt recorded');
      invalidateQueryCache('production:');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Inward failed');
    }
  }

  async function submitResult() {
    const cleaningLines = (cleaningTypes || [])
      .map((t: any) => ({ wastageTypeId: t.id, quantity: cleanQty[t.id] || 0, unit: 'KG' }))
      .filter((l: any) => l.quantity > 0);
    const hullingLines =
      jw.processType === 'FULL_PROCESS'
        ? (hullingTypes || [])
            .map((t: any) => ({ wastageTypeId: t.id, quantity: hullQty[t.id] || 0, unit: 'KG' }))
            .filter((l: any) => l.quantity > 0)
        : [];
    const all = [...cleaningLines, ...hullingLines];
    const dispositions = all.map((l) => ({
      wastageTypeId: l.wastageTypeId,
      action: disp[l.wastageTypeId] || 'RETURNED',
    }));
    try {
      await api.production.jobWork.processResult(id, {
        totalProcessedInputKg: Number(processedInput),
        cleaningLines,
        hullingLines,
        dispositions,
      });
      showSuccess('Process result saved');
      setResultOpen(false);
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Process result failed');
    }
  }

  async function reopenJw() {
    const reason = window.prompt('Admin correction reason to reopen this closed Job Work:');
    if (!reason?.trim()) return;
    try {
      await api.production.jobWork.reopen(id, { varianceReason: reason.trim() });
      showSuccess('Job Work reopened for correction');
      await load();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Reopen failed');
    }
  }

  async function closeJw() {
    try {
      await api.production.jobWork.close(id, {});
      showSuccess('Job Work closed');
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Close failed';
      if (msg.includes('Unreconciled')) {
        const reason = window.prompt(`${msg}\nAdmin variance reason:`);
        if (!reason) return;
        const varianceKg = Number(window.prompt('Variance KG (still outside)?') || 0);
        try {
          await api.production.jobWork.close(id, { varianceKg, varianceReason: reason });
          showSuccess('Closed with variance');
          await load();
        } catch (e2: unknown) {
          showError(e2 instanceof Error ? e2.message : 'Close failed');
        }
      } else {
        showError(msg);
      }
    }
  }

  async function reSortex() {
    const qty = Number(window.prompt(`Available for Re-Sortex: ${availableReSortex} KG\nQuantity:`, String(availableReSortex)));
    if (!qty) return;
    try {
      const run = await api.production.jobWork.reSortex(id, {
        quantityKg: qty,
        startDate: new Date().toISOString().slice(0, 10),
      });
      showSuccess(`Re-Sortex run ${run.productionNumber} created`);
      router.push(`/production/runs/${run.id}`);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Re-Sortex failed');
    }
  }

  return (
    <ProductionShell title={jw.jobWorkNumber} subtitle={`${jw.jobWorker?.name} · ${jw.product?.name}`}>
      <Link href="/production/job-work" className="mb-4 inline-block text-sm text-blue-600">
        ← Back
      </Link>

      <div className="ems-card mb-4 grid gap-3 p-4 sm:grid-cols-5">
        <div>
          <p className="text-xs text-slate-400">Status</p>
          <p className="font-medium">{jw.status?.replace(/_/g, ' ')}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Process</p>
          <p className="font-medium">{jw.processType?.replace(/_/g, ' ')}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Total Sent</p>
          <p className="font-medium">{formatNumber(jw.totalSentKg, 0)} KG</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Total Processed</p>
          <p className="font-medium">{formatNumber(jw.totalProcessedInputKg || recon.totalProcessedInputKg || 0, 0)} KG</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Still Outside</p>
          <p className="font-medium">{formatNumber(recon.quantityStillOutsideKg, 0)} KG</p>
        </div>
      </div>

      <div className="ems-card mb-4 p-4">
        <h3 className="mb-2 font-semibold">Reconciliation</h3>
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p>Total processed input: {formatNumber(jw.totalProcessedInputKg || recon.totalProcessedInputKg || 0, 0)} KG</p>
          <p>Processed expected: {formatNumber(recon.processedOutputExpectedKg, 0)} KG</p>
          <p>Processed received: {formatNumber(recon.processedOutputReceivedKg, 0)} KG</p>
          <p>Wastage expected return: {formatNumber(recon.wastageExpectedReturnKg, 0)} KG</p>
          <p>Wastage received: {formatNumber(recon.wastageReceivedKg, 0)} KG</p>
          <p>Wastage discarded: {formatNumber(recon.wastageDiscardedKg, 0)} KG</p>
          <p className={recon.flagged ? 'font-semibold text-rose-600' : ''}>
            Diff: {formatNumber(recon.reconciliationDifferenceKg, 0)} KG
            {jw.wastageAlert ? ` · Wastage ${jw.wastagePct ?? ''}%` : ''}
          </p>
        </div>
      </div>

      {jw.status === 'CLOSED' && (
        <div className="mb-4">
          <button type="button" className="ems-btn-secondary text-sm" onClick={reopenJw}>
            Admin: reopen for correction
          </button>
        </div>
      )}

      {jw.status !== 'CLOSED' && (
        <>
          <div className="ems-card mb-4 p-4">
            <h3 className="mb-2 font-semibold">Add Outward / More Material</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="ems-input"
                type="date"
                value={outward.outwardDate}
                onChange={(e) => setOutward((o) => ({ ...o, outwardDate: e.target.value }))}
              />
              <input
                className="ems-input"
                type="number"
                placeholder="Quantity KG"
                value={outward.quantity || ''}
                onChange={(e) => setOutward((o) => ({ ...o, quantity: Number(e.target.value) }))}
              />
              <input
                className="ems-input"
                placeholder="Truck"
                value={outward.truckNumber}
                onChange={(e) => setOutward((o) => ({ ...o, truckNumber: e.target.value }))}
              />
              <input
                className="ems-input"
                placeholder="Challan"
                value={outward.challanNumber}
                onChange={(e) => setOutward((o) => ({ ...o, challanNumber: e.target.value }))}
              />
            </div>
            <button type="button" className="ems-btn-primary mt-2 text-sm" onClick={addOutward}>
              Record Outward
            </button>
            <ul className="mt-3 text-sm text-slate-600">
              {(jw.outwards || []).map((o: any) => (
                <li key={o.id}>
                  {o.outwardNumber}: {formatNumber(o.quantityKg, 0)} KG on {formatDate(o.outwardDate)}
                </li>
              ))}
            </ul>
          </div>

          <div className="ems-card mb-4 p-4">
            <h3 className="mb-2 font-semibold">Inward / Return Receipt</h3>
            <div className="mb-2 grid gap-2 sm:grid-cols-2">
              <input
                className="ems-input"
                type="date"
                value={inward.receiptDate}
                onChange={(e) => setInward((i) => ({ ...i, receiptDate: e.target.value }))}
              />
              <EmsSelect
                value={inward.receivingLocationId}
                onChange={(v) => setInward((i) => ({ ...i, receivingLocationId: v }))}
                placeholder="Receiving location *"
                options={[
                  { value: '', label: 'Select location' },
                  ...(locations || []).map((l: any) => ({ value: l.id, label: l.name })),
                ]}
              />
            </div>
            {inward.lines.map((line, idx) => (
              <div key={idx} className="mb-2 grid gap-2 sm:grid-cols-3">
                <select
                  className="ems-input"
                  value={line.returnCategory}
                  onChange={(e) => {
                    const lines = [...inward.lines];
                    lines[idx] = { ...lines[idx], returnCategory: e.target.value };
                    setInward((i) => ({ ...i, lines }));
                  }}
                >
                  <option value="PROCESSED">Processed Material</option>
                  <option value="UNPROCESSED">Unprocessed Return</option>
                  <option value="WASTAGE">Wastage</option>
                </select>
                {line.returnCategory === 'WASTAGE' && (
                  <EmsSelect
                    value={line.wastageTypeId}
                    onChange={(v) => {
                      const lines = [...inward.lines];
                      lines[idx] = { ...lines[idx], wastageTypeId: v };
                      setInward((i) => ({ ...i, lines }));
                    }}
                    placeholder="Wastage type"
                    options={[
                      { value: '', label: 'Type' },
                      ...[...(cleaningTypes || []), ...(hullingTypes || [])].map((t: any) => ({
                        value: t.id,
                        label: t.nameEn,
                      })),
                    ]}
                  />
                )}
                <input
                  className="ems-input"
                  type="number"
                  placeholder="KG"
                  value={line.quantity || ''}
                  onChange={(e) => {
                    const lines = [...inward.lines];
                    lines[idx] = { ...lines[idx], quantity: Number(e.target.value) };
                    setInward((i) => ({ ...i, lines }));
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="mr-2 text-sm text-blue-600"
              onClick={() =>
                setInward((i) => ({
                  ...i,
                  lines: [...i.lines, { returnCategory: 'PROCESSED', wastageTypeId: '', quantity: 0 }],
                }))
              }
            >
              + Line
            </button>
            <button type="button" className="ems-btn-primary mt-2 text-sm" onClick={addInward}>
              Record Receipt
            </button>
            <ul className="mt-3 text-sm text-slate-600">
              {(jw.inwards || []).map((i: any) => (
                <li key={i.id}>
                  {i.inwardNumber} · {formatDate(i.receiptDate)} ·{' '}
                  {(i.lines || []).map((l: any) => `${l.returnCategory} ${formatNumber(l.quantityKg, 0)}KG`).join(', ')}
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button type="button" className="ems-btn-secondary text-sm" onClick={() => setResultOpen(true)}>
              Enter Process Result
            </button>
            <button type="button" className="ems-btn-primary text-sm" onClick={closeJw}>
              Close Job Work
            </button>
            {availableReSortex > 0.001 && (
              <button type="button" className="ems-btn-secondary text-sm" onClick={reSortex}>
                Start Re-Sortex — {formatNumber(availableReSortex, 0)} KG available
              </button>
            )}
          </div>
        </>
      )}

      {resultOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5">
            <h3 className="mb-3 font-semibold">Job Work Process Result</h3>
            <label className="ems-label">Total quantity processed (KG)</label>
            <input
              className="ems-input mb-3 w-full"
              type="number"
              value={processedInput || ''}
              onChange={(e) => setProcessedInput(Number(e.target.value))}
            />
            <p className="mb-1 text-sm font-medium">Cleaning / Type 2–4</p>
            {(cleaningTypes || []).map((t: any) => (
              <div key={t.id} className="mb-2 flex gap-2">
                <span className="w-28 text-sm">{t.nameEn}</span>
                <input
                  className="ems-input flex-1"
                  type="number"
                  placeholder="KG"
                  value={cleanQty[t.id] || ''}
                  onChange={(e) => setCleanQty((q) => ({ ...q, [t.id]: Number(e.target.value) }))}
                />
                <select
                  className="ems-input"
                  value={disp[t.id] || 'RETURNED'}
                  onChange={(e) => setDisp((d) => ({ ...d, [t.id]: e.target.value }))}
                >
                  <option value="RETURNED">Returned</option>
                  <option value="DISCARDED_AT_WORKER">Discarded at worker</option>
                </select>
              </div>
            ))}
            {jw.processType === 'FULL_PROCESS' && (
              <>
                <p className="mb-1 mt-3 text-sm font-medium">Hulling wastage</p>
                {(hullingTypes || []).map((t: any) => (
                  <div key={t.id} className="mb-2 flex gap-2">
                    <span className="w-28 text-sm">{t.nameEn}</span>
                    <input
                      className="ems-input flex-1"
                      type="number"
                      placeholder="KG"
                      value={hullQty[t.id] || ''}
                      onChange={(e) => setHullQty((q) => ({ ...q, [t.id]: Number(e.target.value) }))}
                    />
                    <select
                      className="ems-input"
                      value={disp[t.id] || 'RETURNED'}
                      onChange={(e) => setDisp((d) => ({ ...d, [t.id]: e.target.value }))}
                    >
                      <option value="RETURNED">Returned</option>
                      <option value="DISCARDED_AT_WORKER">Discarded at worker</option>
                    </select>
                  </div>
                ))}
              </>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="ems-btn-secondary text-sm" onClick={() => setResultOpen(false)}>
                Cancel
              </button>
              <button type="button" className="ems-btn-primary text-sm" onClick={submitResult}>
                Save Result
              </button>
            </div>
          </div>
        </div>
      )}
    </ProductionShell>
  );
}
