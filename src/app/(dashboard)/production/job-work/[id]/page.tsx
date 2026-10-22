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
        <h3 className="mb-3 font-semibold text-slate-800">Job Work Reconciliation</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3">
            <span className="text-xs font-semibold uppercase text-blue-700">1. Total Material Outward</span>
            <p className="mt-1 text-xl font-bold text-blue-900">
              {formatNumber(recon.totalMaterialOutwardKg ?? jw.totalSentKg ?? 0, 0)} KG
            </p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
            <span className="text-xs font-semibold uppercase text-emerald-700">2. Processed Received</span>
            <p className="mt-1 text-xl font-bold text-emerald-900">
              {formatNumber(recon.totalProcessedReceivedKg ?? recon.processedOutputReceivedKg ?? 0, 0)} KG
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
            <span className="text-xs font-semibold uppercase text-amber-700">3. Wastage Received</span>
            <p className="mt-1 text-xl font-bold text-amber-900">
              {formatNumber(recon.totalWastageReceivedKg ?? recon.wastageReceivedKg ?? 0, 0)} KG
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs font-semibold uppercase text-slate-600">Unprocessed Returned</span>
            <p className="mt-1 text-xl font-bold text-slate-800">
              {formatNumber(recon.unprocessedReturnedKg ?? 0, 0)} KG
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-sm">
          <div>
            <span className="text-slate-500">Unreconciled Difference / Outside: </span>
            <span
              className={`font-bold ${
                Math.abs(recon.differenceKg ?? recon.quantityStillOutsideKg ?? 0) > 0.001
                  ? 'text-rose-600'
                  : 'text-emerald-600'
              }`}
            >
              {formatNumber(recon.differenceKg ?? recon.quantityStillOutsideKg ?? 0, 0)} KG
            </span>
          </div>
          {recon.flagged && (
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
              Discrepancy Flagged
            </span>
          )}
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
    </ProductionShell>
  );
}
