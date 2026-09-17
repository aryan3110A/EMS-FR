'use client';

import { useState } from 'react';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { EmsSelect } from '@/components/ui/ems-select';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

export default function SamplingPage() {
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    status: 'PASSED',
    result: '',
    collectionDate: new Date().toISOString().slice(0, 10),
    resultDate: new Date().toISOString().slice(0, 10),
    testingAgency: '',
    reportReference: '',
    remarks: '',
  });
  const [saving, setSaving] = useState(false);

  const { data: samples, refresh: refreshSamples } = useCachedQuery(
    'production:samples',
    () => api.production.samples(),
    { ttl: PRODUCTION_CACHE_TTL },
  );
  const { data: rejected, refresh: refreshRejected } = useCachedQuery(
    'production:rejected-lots',
    () => api.production.rejectedLots(),
    { ttl: PRODUCTION_CACHE_TTL },
  );

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.production.updateSample(editing.id, form);
      showSuccess(form.status === 'FAILED' ? 'Sample failed — rejected lot created (Sortex)' : 'Sample updated');
      setEditing(null);
      invalidateQueryCache('production:');
      await Promise.all([refreshSamples(), refreshRejected()]);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProductionShell title="Sampling / QC" subtitle="EU sampling results and sample-rejected stock">
      <div className="ems-card mb-4 p-4">
        <h3 className="mb-3 font-semibold">Sample records</h3>
        <table className="ems-table w-full text-sm">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Container</th>
              <th>Product</th>
              <th>Status</th>
              <th>Result date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(samples || []).map((s: any) => (
              <tr key={s.id}>
                <td>{s.contract?.contractNumber || s.contractId}</td>
                <td>{s.container?.containerIndex ?? '—'}</td>
                <td>{s.product?.name || s.productId}</td>
                <td>{s.status?.replace(/_/g, ' ')}</td>
                <td>{s.resultDate ? formatDate(s.resultDate) : '—'}</td>
                <td>
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      setEditing(s);
                      setForm({
                        status: s.status === 'PASSED' || s.status === 'FAILED' ? s.status : 'PASSED',
                        result: s.result || '',
                        collectionDate: s.collectionDate ? String(s.collectionDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
                        resultDate: new Date().toISOString().slice(0, 10),
                        testingAgency: s.testingAgency || '',
                        reportReference: s.reportReference || '',
                        remarks: s.remarks || '',
                      });
                    }}
                  >
                    Update
                  </button>
                </td>
              </tr>
            ))}
            {!samples?.length && (
              <tr>
                <td colSpan={6} className="text-slate-400">
                  No sample records yet (created when EU containers are fulfilled)
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
                <td>{formatNumber(r.remainingKg ?? r.quantityKg ?? 0, 0)}</td>
                <td>{r.location?.name}</td>
                <td>{r.status || 'AVAILABLE'}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Update sample result</h3>
            <div className="space-y-3">
              <EmsSelect
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                placeholder="Sample status"
                options={[
                  { value: 'READY_FOR_SAMPLING', label: 'Ready for Sampling' },
                  { value: 'SAMPLE_COLLECTED', label: 'Sample Collected' },
                  { value: 'TESTING_IN_PROGRESS', label: 'Testing in Progress' },
                  { value: 'PASSED', label: 'Passed' },
                  { value: 'FAILED', label: 'Failed' },
                  { value: 'REPROCESSING_REQUIRED', label: 'Reprocessing Required' },
                  { value: 'RESAMPLING_REQUIRED', label: 'Resampling Required' },
                ]}
              />
              <input className="ems-input w-full" placeholder="Result notes" value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))} />
              <input className="ems-input w-full" type="date" value={form.collectionDate} onChange={(e) => setForm((f) => ({ ...f, collectionDate: e.target.value }))} />
              <input className="ems-input w-full" type="date" value={form.resultDate} onChange={(e) => setForm((f) => ({ ...f, resultDate: e.target.value }))} />
              <input className="ems-input w-full" placeholder="Testing agency" value={form.testingAgency} onChange={(e) => setForm((f) => ({ ...f, testingAgency: e.target.value }))} />
              <input className="ems-input w-full" placeholder="Report reference" value={form.reportReference} onChange={(e) => setForm((f) => ({ ...f, reportReference: e.target.value }))} />
              <textarea className="ems-input w-full min-h-[60px]" placeholder="Remarks" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="ems-btn-secondary text-sm" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" className="ems-btn-primary text-sm" disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save result'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProductionShell>
  );
}
