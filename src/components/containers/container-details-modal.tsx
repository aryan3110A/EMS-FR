'use client';

import { useState } from 'react';
import { api, type ContainerWorkflowView } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { formatDate, formatNumber } from '@/lib/utils';

type Props = {
  view: ContainerWorkflowView;
  /** Post-dispatch correction (SUPER_ADMIN only) requires a reason */
  correction?: boolean;
  onClose: () => void;
  onSaved: (view: ContainerWorkflowView) => void;
};

/** Container Details form (ERP Changes 22.11.26 §8.2–8.3). Saves to the same container record. */
export function ContainerDetailsModal({ view, correction, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    containerNo: view.details.containerNo || '',
    factorySealNo: view.details.factorySealNo || '',
    shippingLineName: view.details.shippingLineName || '',
    shippingLineSealNo: view.details.shippingLineSealNo || '',
    remarks: view.details.remarks || '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const missing = [
    !form.containerNo.trim() && 'Container Number',
    !form.factorySealNo.trim() && 'Factory Seal Number',
    !form.shippingLineName.trim() && 'Shipping Line Name',
    !form.shippingLineSealNo.trim() && 'Shipping Line Seal Number',
  ].filter(Boolean) as string[];

  async function save() {
    if (correction && !form.reason.trim()) {
      showError('A reason is required for a post-dispatch correction');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.containerAction(view.contract.id, view.containerId, {
        action: correction ? 'CORRECT_DETAILS_AFTER_DISPATCH' : 'UPDATE_DETAILS',
        containerNo: form.containerNo,
        factorySealNo: form.factorySealNo,
        shippingLineName: form.shippingLineName,
        shippingLineSealNo: form.shippingLineSealNo,
        remarks: form.remarks,
        reason: correction ? form.reason : undefined,
      });
      showSuccess(
        missing.length
          ? 'Saved — container stays "Details Pending" until all mandatory details are entered'
          : 'Container details saved',
      );
      onSaved(updated);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Could not save container details');
    } finally {
      setSaving(false);
    }
  }

  const ro = (label: string, value: React.ReactNode) => (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-800">
          {correction ? 'Correct Container Details (after dispatch)' : 'Container Details'}
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Saved against this container. The same values appear in Contracts → Actions → Container Status.
        </p>

        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {ro('Contract Number', view.contract.contractNumber)}
          {ro('Container Reference', `Container ${view.containerIndex}`)}
          {ro('Product', view.contract.product)}
          {ro('Required Quantity', `${formatNumber(view.fulfilment.requiredKg, 0)} KG`)}
          {ro('Fulfilled Quantity', `${formatNumber(view.fulfilment.fulfilledKg, 0)} KG`)}
          {ro('Last Updated', view.details.updatedAt ? `${formatDate(view.details.updatedAt)} · ${view.details.updatedBy || ''}` : null)}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="ems-label">Container Number *</label>
            <input className="ems-input w-full" value={form.containerNo} onChange={set('containerNo')} maxLength={40} />
          </div>
          <div>
            <label className="ems-label">Factory Seal Number *</label>
            <input className="ems-input w-full" value={form.factorySealNo} onChange={set('factorySealNo')} maxLength={60} />
          </div>
          <div>
            <label className="ems-label">Shipping Line Name *</label>
            <input className="ems-input w-full" value={form.shippingLineName} onChange={set('shippingLineName')} maxLength={120} />
          </div>
          <div>
            <label className="ems-label">Shipping Line Seal Number *</label>
            <input className="ems-input w-full" value={form.shippingLineSealNo} onChange={set('shippingLineSealNo')} maxLength={60} />
          </div>
          <div className="sm:col-span-2">
            <label className="ems-label">Remarks</label>
            <textarea className="ems-input w-full" rows={2} value={form.remarks} onChange={set('remarks')} maxLength={1000} />
          </div>
          {correction && (
            <div className="sm:col-span-2">
              <label className="ems-label">Reason for correction *</label>
              <input className="ems-input w-full" value={form.reason} onChange={set('reason')} maxLength={500} />
            </div>
          )}
        </div>

        {missing.length > 0 && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            Still missing: {missing.join(', ')}. You can save now — the container will show
            &quot;Fulfilled — Container Details Pending&quot; and cannot be dispatched until these are entered.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="ems-btn-secondary text-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="ems-btn-primary text-sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Container Details'}
          </button>
        </div>
      </div>
    </div>
  );
}
