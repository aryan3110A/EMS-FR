'use client';

import { useState } from 'react';
import { api, type ContainerActionPayload, type ContainerWorkflowView } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { formatDate, formatNumber } from '@/lib/utils';
import { StageBadge } from './stage-badge';
import { ContainerDetailsModal } from './container-details-modal';

const ACTION_LABEL: Record<string, string> = {
  UPDATE_DETAILS: 'Update Container Details',
  CORRECT_DETAILS_AFTER_DISPATCH: 'Correct Details (after dispatch)',
  PROCEED_TO_SAMPLING: 'Proceed to Sampling',
  MARK_SAMPLE_SENT: 'Mark Sample Collected / Sent',
  MARK_AWAITING_RESULT: 'Mark Awaiting Result',
  RECORD_RESULT: 'Record Sampling Result',
  APPROVE_SAMPLING: 'Approve for Dispatch',
  MARK_READY_FOR_DISPATCH: 'Mark Ready for Dispatch',
  MARK_DISPATCHED: 'Mark as Dispatched',
  MARK_REACHED_PORT: 'Mark Reached Port',
  MARK_SHIPPED: 'Mark Shipped',
  PUT_ON_HOLD: 'Put On Hold',
  RELEASE_HOLD: 'Release Hold',
};
const PRIMARY = new Set([
  'UPDATE_DETAILS',
  'PROCEED_TO_SAMPLING',
  'MARK_SAMPLE_SENT',
  'MARK_AWAITING_RESULT',
  'RECORD_RESULT',
  'APPROVE_SAMPLING',
  'MARK_READY_FOR_DISPATCH',
  'MARK_DISPATCHED',
]);
const FULFIL_LABEL: Record<string, string> = {
  NOT_FULFILLED: 'Not Fulfilled',
  PARTIALLY_FULFILLED: 'Partially Fulfilled',
  FULFILLED: 'Fulfilled',
};
const SAMPLING_LABEL: Record<string, string> = {
  NOT_REQUIRED: 'Sampling Not Required',
  NOT_STARTED: 'Not Started',
  PENDING: 'Sampling Pending',
  SAMPLE_SENT: 'Sample Collected / Sent',
  AWAITING_RESULT: 'Awaiting Result',
  RESULT_RECEIVED: 'Result Received — approval pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected / On Hold',
};
const DISPATCH_LABEL: Record<string, string> = {
  NOT_READY: 'Not Ready',
  READY: 'Ready for Dispatch',
  DISPATCHED: 'Dispatched',
};
const today = () => new Date().toISOString().slice(0, 10);

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value ?? '—'}</p>
    </div>
  );
}
function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
        {aside}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

type FormSpec = { title: string; fields: { key: keyof ContainerActionPayload; label: string; type?: string; required?: boolean; options?: string[] }[]; note?: string };
const FORMS: Record<string, FormSpec> = {
  MARK_SAMPLE_SENT: {
    title: 'Sample Collected / Sent',
    fields: [
      { key: 'samplingDate', label: 'Sampling Date', type: 'date', required: true },
      { key: 'samplingType', label: 'Sampling Type (e.g. Salmonella, Pesticide, Aflatoxin)' },
      { key: 'sampleReference', label: 'Sample Reference' },
      { key: 'remarks', label: 'Remarks' },
    ],
  },
  MARK_AWAITING_RESULT: {
    title: 'Sample Submitted — Awaiting Result',
    fields: [{ key: 'testingAgency', label: 'Testing Agency / Lab' }, { key: 'remarks', label: 'Remarks' }],
  },
  RECORD_RESULT: {
    title: 'Record Sampling Result',
    note: 'A passing result is recorded as "Result Received". Approval for dispatch is a separate step.',
    fields: [
      { key: 'result', label: 'Result Status', required: true, options: ['PASSED', 'FAILED'] },
      { key: 'resultDate', label: 'Result Date', type: 'date', required: true },
      { key: 'resultReference', label: 'Result Reference / Report No.' },
      { key: 'remarks', label: 'Remarks' },
    ],
  },
  APPROVE_SAMPLING: {
    title: 'Approve Sampling for Dispatch',
    note: 'Confirms the required result passed and the container may proceed towards dispatch.',
    fields: [{ key: 'remarks', label: 'Remarks' }],
  },
  MARK_READY_FOR_DISPATCH: {
    title: 'Mark Ready for Dispatch',
    note: 'Confirm the container is physically ready to leave the factory.',
    fields: [{ key: 'remarks', label: 'Remarks' }],
  },
  MARK_DISPATCHED: {
    title: 'Mark as Dispatched',
    note: 'Records the physical dispatch. Allocated stock leaves the factory inventory (posted once).',
    fields: [
      { key: 'dispatchDate', label: 'Dispatch Date', type: 'date', required: true },
      { key: 'remarks', label: 'Dispatch Remarks (vehicle, driver…)' },
    ],
  },
  MARK_REACHED_PORT: { title: 'Container Reached Port', fields: [{ key: 'remarks', label: 'Remarks' }] },
  MARK_SHIPPED: {
    title: 'Container Shipped',
    fields: [{ key: 'shipmentDate', label: 'Shipment Date', type: 'date', required: true }, { key: 'remarks', label: 'Remarks' }],
  },
  PUT_ON_HOLD: { title: 'Put Container On Hold', fields: [{ key: 'reason', label: 'Reason', required: true }] },
  RELEASE_HOLD: { title: 'Release Hold', fields: [{ key: 'remarks', label: 'Remarks' }] },
  PROCEED_TO_SAMPLING: {
    title: 'Proceed to Sampling',
    note: 'Creates the sampling record(s) for this container (EU / Russia destination).',
    fields: [{ key: 'remarks', label: 'Remarks' }],
  },
};

export function ContainerWorkflowCard({ view, onChanged }: { view: ContainerWorkflowView; onChanged: (v: ContainerWorkflowView) => void }) {
  const [action, setAction] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const f = view.fulfilment;
  const s = view.sampling;
  const d = view.details;

  function open(a: string) {
    setForm({ samplingDate: today(), resultDate: today(), dispatchDate: today(), shipmentDate: today() });
    setAction(a);
  }

  async function submit() {
    if (!action) return;
    const spec = FORMS[action];
    for (const field of spec?.fields || []) {
      if (field.required && !String(form[field.key] || '').trim()) {
        showError(`${field.label} is required`);
        return;
      }
    }
    setBusy(true);
    try {
      const payload: ContainerActionPayload = { action };
      for (const field of spec?.fields || []) {
        const v = String(form[field.key] || '').trim();
        if (v) (payload as Record<string, unknown>)[field.key] = v;
      }
      const updated = await api.containerAction(view.contract.id, view.containerId, payload);
      showSuccess(`${ACTION_LABEL[action]} — now "${updated.stageLabel}"`);
      setAction(null);
      onChanged(updated);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const pct = f.requiredKg > 0 ? Math.min(100, (f.fulfilledKg / f.requiredKg) * 100) : 0;
  const detailsAction = view.availableActions.find((a) => a === 'UPDATE_DETAILS' || a === 'CORRECT_DETAILS_AFTER_DISPATCH');

  return (
    <div className="ems-card p-4" id={`container-${view.containerId}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            Container {view.containerIndex}
            {d.containerNo ? <span className="ml-2 font-mono text-sm text-slate-500">{d.containerNo}</span> : null}
          </h3>
          <p className="text-xs text-slate-500">
            {view.contract.product} · {view.contract.destinationCountry || view.contract.destinationPort || 'Destination not set'}
          </p>
        </div>
        <StageBadge stage={view.stage} label={view.stageLabel} />
      </div>

      <div className="space-y-3">
        <Section title="A. Contract Information">
          <Field label="Contract Number" value={view.contract.contractNumber} />
          <Field label="Product" value={view.contract.product} />
          <Field label="Destination Country" value={view.contract.destinationCountry} />
          <Field label="EU / Non-EU" value={view.contract.euClassification?.replace('_', '-')} />
          <Field label="Packaging" value={view.contract.packaging} />
          <Field label="Container Required Quantity" value={`${formatNumber(f.requiredKg, 0)} KG`} />
        </Section>

        <Section title="B. Fulfillment Information" aside={<span className="text-xs font-semibold text-slate-600">{FULFIL_LABEL[f.status]}</span>}>
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full ${f.status === 'FULFILLED' ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <Field label="Total Fulfilled Quantity" value={`${formatNumber(f.fulfilledKg, 0)} KG`} />
          <Field label="Remaining Quantity" value={`${formatNumber(f.remainingKg, 0)} KG`} />
          <Field label="Fulfillment Status" value={FULFIL_LABEL[f.status]} />
          <Field label="First Allocation Date" value={f.firstAllocationDate ? formatDate(f.firstAllocationDate) : '—'} />
          <Field label="Full Fulfillment Date" value={f.fullFulfilmentDate ? formatDate(f.fullFulfilmentDate) : '—'} />
          <Field
            label="Linked Production Lots"
            value={
              f.lots.length
                ? f.lots
                    .map((l) => `${l.lotNumber || l.productionNumber || 'lot'} (${formatNumber(l.quantityKg, 0)} KG${l.status !== 'ACTIVE' ? `, ${l.status.toLowerCase()}` : ''})`)
                    .join(', ')
                : '—'
            }
          />
        </Section>

        <Section
          title="C. Container Information"
          aside={
            <span className={`text-xs font-semibold ${d.status === 'COMPLETED' ? 'text-emerald-700' : 'text-amber-700'}`}>
              Details {d.status === 'COMPLETED' ? 'Completed' : 'Pending'}
            </span>
          }
        >
          <Field label="Container Number" value={d.containerNo} />
          <Field label="Factory Seal Number" value={d.factorySealNo} />
          <Field label="Shipping Line Name" value={d.shippingLineName} />
          <Field label="Shipping Line Seal Number" value={d.shippingLineSealNo} />
          <Field label="Remarks" value={d.remarks} />
          <Field label="Updated" value={d.updatedAt ? `${formatDate(d.updatedAt)}${d.updatedBy ? ` · ${d.updatedBy}` : ''}` : '—'} />
        </Section>

        {s.required ? (
          <Section title="D. Sampling Information" aside={<span className="text-xs font-semibold text-violet-700">Sampling Required: Yes ({s.reason === 'RUSSIA' ? 'Russia' : 'EU'})</span>}>
            <Field label="Sampling Status" value={SAMPLING_LABEL[s.status] || s.status} />
            <Field label="Sampling Date" value={s.samplingDate ? formatDate(s.samplingDate) : '—'} />
            <Field label="Result Status" value={s.resultStatus} />
            <Field label="Result Date" value={s.resultDate ? formatDate(s.resultDate) : '—'} />
            <Field label="Approved" value={s.approvedAt ? formatDate(s.approvedAt) : '—'} />
            <Field
              label="Sampling References"
              value={
                s.records
                  .map((r) => [r.sampleReference, r.reportReference].filter(Boolean).join(' / '))
                  .filter(Boolean)
                  .join(', ') || '—'
              }
            />
          </Section>
        ) : (
          <div className="rounded-lg border border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
            D. Sampling: <span className="text-slate-700">Sampling Not Required</span>{' '}
            {s.reason === 'UNKNOWN_DESTINATION' ? '(destination not set on the contract)' : '(destination is not EU or Russia)'}
          </div>
        )}

        <Section title="E. Dispatch Information" aside={<span className="text-xs font-semibold text-slate-600">{DISPATCH_LABEL[view.dispatch.status]}</span>}>
          <Field
            label="Ready for Dispatch"
            value={view.dispatch.readyForDispatchAt ? `${formatDate(view.dispatch.readyForDispatchAt)}${view.dispatch.readyBy ? ` · ${view.dispatch.readyBy}` : ''}` : 'No'}
          />
          <Field label="Dispatch Status" value={DISPATCH_LABEL[view.dispatch.status]} />
          <Field
            label="Dispatch Date"
            value={view.dispatch.dispatchedAt ? `${formatDate(view.dispatch.dispatchedAt)}${view.dispatch.dispatchedBy ? ` · ${view.dispatch.dispatchedBy}` : ''}` : '—'}
          />
          <Field label="Days Since Fulfillment" value={view.aging.daysSinceFullFulfilment ?? '—'} />
          <Field label="Days Since First Allocation" value={view.aging.daysSinceFirstAllocation ?? '—'} />
          {s.required && <Field label="Days Waiting for Sampling / Result" value={view.aging.daysWaitingForSampling ?? view.aging.daysAwaitingResult ?? '—'} />}
          {view.aging.daysReadyForDispatch != null && <Field label="Days Ready for Dispatch" value={view.aging.daysReadyForDispatch} />}
        </Section>

        <div className="rounded-lg border border-slate-100 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">F. Available Actions</p>
          {view.availableActions.length === 0 ? (
            <p className="text-sm text-slate-500">
              {f.status === 'NOT_FULFILLED'
                ? 'Waiting for fulfilment from Production or the Fulfilment tab.'
                : 'No action available for your role at this stage.'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {view.availableActions.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={PRIMARY.has(a) ? 'ems-btn-primary text-xs' : 'ems-btn-secondary text-xs'}
                  onClick={() => (a === 'UPDATE_DETAILS' || a === 'CORRECT_DETAILS_AFTER_DISPATCH' ? setAction(a) : open(a))}
                >
                  {ACTION_LABEL[a] || a}
                </button>
              ))}
            </div>
          )}
          {d.status === 'PENDING' && f.status === 'FULFILLED' && (
            <p className="mt-2 text-xs text-amber-700">Dispatch is blocked until: {d.missing.join(', ')}.</p>
          )}
        </div>

        {!!view.history?.length && (
          <div>
            <button type="button" className="text-xs font-medium text-blue-600 hover:underline" onClick={() => setShowHistory((x) => !x)}>
              {showHistory ? 'Hide' : 'Show'} status history ({view.history.length})
            </button>
            {showHistory && (
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                {view.history.map((h, i) => (
                  <li key={i} className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <span className="font-medium">
                      {h.fromLabel || '—'} → {h.toLabel}
                    </span>
                    <span className="text-slate-500">
                      {' '}
                      · {formatDate(h.createdAt)} · {h.changedBy}
                    </span>
                    {h.remarks ? <span className="block text-xs text-slate-500">{h.remarks}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {(action === 'UPDATE_DETAILS' || action === 'CORRECT_DETAILS_AFTER_DISPATCH') && detailsAction && (
        <ContainerDetailsModal
          view={view}
          correction={action === 'CORRECT_DETAILS_AFTER_DISPATCH'}
          onClose={() => setAction(null)}
          onSaved={(v) => {
            setAction(null);
            onChanged(v);
          }}
        />
      )}

      {action && FORMS[action] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-semibold text-slate-800">{FORMS[action].title}</h3>
            <p className="mb-3 text-xs text-slate-500">
              {view.contract.contractNumber} · Container {view.containerIndex}
            </p>
            {FORMS[action].note && <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{FORMS[action].note}</p>}
            <div className="space-y-3">
              {FORMS[action].fields.map((field) => (
                <div key={field.key}>
                  <label className="ems-label">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </label>
                  {field.options ? (
                    <select
                      className="ems-input w-full"
                      value={form[field.key] || ''}
                      onChange={(e) => setForm((x) => ({ ...x, [field.key]: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      {field.options.map((o) => (
                        <option key={o} value={o}>
                          {o === 'PASSED' ? 'Passed' : o === 'FAILED' ? 'Failed / Rejected' : o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="ems-input w-full"
                      type={field.type || 'text'}
                      value={form[field.key] || ''}
                      onChange={(e) => setForm((x) => ({ ...x, [field.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
              {action === 'RECORD_RESULT' && form.result === 'FAILED' && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                  A failed result moves this container&apos;s allocated quantity to Sample-Rejected stock (available for
                  Sortex reprocessing) and blocks dispatch until the container is re-fulfilled and re-sampled.
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="ems-btn-secondary text-sm" onClick={() => setAction(null)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="ems-btn-primary text-sm" onClick={submit} disabled={busy}>
                {busy ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
