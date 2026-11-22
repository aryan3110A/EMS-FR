'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

/** Sample-record status → label and the single valid next step (ERP Changes 22.11.26 §12). */
const STATUS: Record<string, { label: string; next?: { step: Step; label: string } }> = {
  NOT_READY: { label: 'Sampling Pending', next: { step: 'SENT', label: 'Mark Sample Collected / Sent' } },
  READY_FOR_SAMPLING: { label: 'Sampling Pending', next: { step: 'SENT', label: 'Mark Sample Collected / Sent' } },
  SAMPLE_COLLECTED: { label: 'Sample Collected / Sent', next: { step: 'AWAITING_RESULT', label: 'Mark Awaiting Result' } },
  TESTING_IN_PROGRESS: { label: 'Awaiting Result', next: { step: 'RESULT', label: 'Record Result' } },
  RESULT_RECEIVED: { label: 'Result Received — approval pending', next: { step: 'APPROVE', label: 'Approve for Dispatch' } },
  PASSED: { label: 'Approved' },
  FAILED: { label: 'Rejected' },
  REPROCESSING_REQUIRED: { label: 'On Hold — reprocessing required' },
  RESAMPLING_REQUIRED: { label: 'On Hold — resampling required' },
};
type Step = 'SENT' | 'AWAITING_RESULT' | 'RESULT' | 'APPROVE';
const today = () => new Date().toISOString().slice(0, 10);

export default function SamplingPage() {
  const [editing, setEditing] = useState<{ sample: any; step: Step } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: samples, refresh: refreshSamples } = useCachedQuery('production:samples', () => api.production.samples(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: rejected, refresh: refreshRejected } = useCachedQuery(
    'production:rejected-lots',
    () => api.production.rejectedLots(),
    { ttl: PRODUCTION_CACHE_TTL },
  );

  function open(sample: any, step: Step) {
    setForm({ samplingDate: today(), resultDate: today(), testingAgency: sample.testingAgency || '' });
    setEditing({ sample, step });
  }

  async function save() {
    if (!editing) return;
    if (editing.step === 'RESULT' && !form.result) {
      showError('Select the result');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = { step: editing.step };
      for (const [k, v] of Object.entries(form)) if (v?.trim()) body[k] = v.trim();
      await api.production.sampleStep(editing.sample.id, body);
      showSuccess(
        editing.step === 'RESULT' && form.result === 'FAILED'
          ? 'Sample rejected — quantity moved to sample-rejected stock (Sortex)'
          : 'Sampling updated',
      );
      setEditing(null);
      invalidateQueryCache('production:');
      await Promise.all([refreshSamples(), refreshRejected()]);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  const input = (key: string, label: string, type = 'text') => (
    <div>
      <label className="ems-label">{label}</label>
      <input className="ems-input w-full" type={type} value={form[key] || ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
    </div>
  );

  return (
    <ProductionShell title="Sampling / QC" subtitle="Sampling applies only to containers shipped to the EU or Russia">
      <div className="ems-card mb-4 p-4">
        <h3 className="mb-1 font-semibold">Sample records</h3>
        <p className="mb-3 text-xs text-slate-500">
          Created with &quot;Proceed to Sampling&quot; on the Container Status screen once an EU / Russia container is
          fulfilled and its container details are complete. A passing result must still be approved before dispatch.
        </p>
        <table className="ems-table w-full text-sm">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Container</th>
              <th>Product</th>
              <th>Status</th>
              <th>Sampled</th>
              <th>Result</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(samples || []).map((s: any) => {
              const st = STATUS[s.status] || { label: s.status };
              return (
                <tr key={s.id}>
                  <td>{s.contract?.contractNumber || s.contractId}</td>
                  <td>
                    <Link href={`/contracts/${s.contractId}/containers#container-${s.containerId}`} className="text-blue-600 hover:underline">
                      Container {s.container?.containerIndex ?? '—'}
                    </Link>
                  </td>
                  <td>{s.product?.name || s.productId}</td>
                  <td>{st.label}</td>
                  <td>
                    {s.collectionDate ? formatDate(s.collectionDate) : '—'}
                    {s.sampleReference ? <span className="block text-xs text-slate-500">{s.sampleReference}</span> : null}
                  </td>
                  <td>
                    {s.result ? `${s.result}${s.resultDate ? ` · ${formatDate(s.resultDate)}` : ''}` : '—'}
                  </td>
                  <td>
                    {st.next && (
                      <button type="button" className="text-blue-600 hover:underline" onClick={() => open(s, st.next!.step)}>
                        {st.next.label}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!samples?.length && (
              <tr>
                <td colSpan={7} className="text-slate-400">
                  No sample records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ems-card p-4">
        <h3 className="mb-3 font-semibold">Sample-rejected lots (Sortex reuse)</h3>
        <table className="ems-table w-full text-sm">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Product</th>
              <th>Qty KG</th>
              <th>Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(rejected || []).map((r: any) => (
              <tr key={r.id}>
                <td>{r.lotNumber || r.id.slice(0, 8)}</td>
                <td>{r.product?.name}</td>
                <td>{formatNumber(r.availableKg ?? r.quantityKg ?? 0, 0)}</td>
                <td>{r.plant?.name || r.location?.name}</td>
                <td>{(r.status || 'AVAILABLE').replace(/_/g, ' ')}</td>
              </tr>
            ))}
            {!rejected?.length && (
              <tr>
                <td colSpan={5} className="text-slate-400">
                  No rejected lots
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-lg font-semibold">{STATUS[editing.sample.status]?.next?.label}</h3>
            <p className="mb-3 text-xs text-slate-500">
              {editing.sample.contract?.contractNumber} · Container {editing.sample.container?.containerIndex} ·{' '}
              {editing.sample.product?.name}
            </p>
            <div className="space-y-3">
              {editing.step === 'SENT' && (
                <>
                  {input('samplingDate', 'Sampling Date *', 'date')}
                  {input('samplingType', 'Sampling Type (e.g. Salmonella, Pesticide, Aflatoxin)')}
                  {input('sampleReference', 'Sample Reference')}
                  {input('remarks', 'Remarks')}
                </>
              )}
              {editing.step === 'AWAITING_RESULT' && (
                <>
                  {input('testingAgency', 'Testing Agency / Lab')}
                  {input('remarks', 'Remarks')}
                </>
              )}
              {editing.step === 'RESULT' && (
                <>
                  <div>
                    <label className="ems-label">Result Status *</label>
                    <select className="ems-input w-full" value={form.result || ''} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}>
                      <option value="">Select…</option>
                      <option value="PASSED">Passed</option>
                      <option value="FAILED">Failed / Rejected</option>
                    </select>
                  </div>
                  {input('resultDate', 'Result Date *', 'date')}
                  {input('resultReference', 'Result Reference / Report No.')}
                  {input('remarks', 'Remarks')}
                  {form.result === 'PASSED' && (
                    <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                      Recorded as &quot;Result Received&quot;. Approve it separately to allow dispatch.
                    </p>
                  )}
                  {form.result === 'FAILED' && (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                      The allocated quantity moves to sample-rejected stock (Sortex reprocessing) and dispatch is blocked.
                    </p>
                  )}
                </>
              )}
              {editing.step === 'APPROVE' && input('remarks', 'Remarks')}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="ems-btn-secondary text-sm" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" className="ems-btn-primary text-sm" disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProductionShell>
  );
}
