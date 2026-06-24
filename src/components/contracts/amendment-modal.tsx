'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { Field } from '@/components/contracts/form-fields';

type Props = {
  open: boolean;
  contractId: string;
  containerId: string;
  incoterm: string;
  currentPrice: number;
  onClose: () => void;
  onAmended: () => void;
};

export function AmendmentModal({
  open,
  contractId,
  containerId,
  incoterm,
  currentPrice,
  onClose,
  onAmended,
}: Props) {
  const [reason, setReason] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const label = incoterm === 'CNF' ? 'CNF' : 'CIF';

  async function handleSubmit() {
    if (!reason.trim()) {
      showError('Amendment reason is required');
      return;
    }
    const price = Number(newPrice);
    if (!price || price <= 0) {
      showError('Enter a valid new price');
      return;
    }
    setSaving(true);
    try {
      await api.amendContainerCommercial(contractId, containerId, {
        reason: reason.trim(),
        newPrice: price,
        currency,
      });
      showSuccess(`${label} price amended successfully`);
      onAmended();
      onClose();
    } catch (e) {
      showError(e, 'Amendment failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Change {label} / {label}</h2>
        <div className="space-y-3">
          <ReadOnlyField label={`Current ${label} Price`} value={String(currentPrice)} />
          <Field label="Reason for Change *">
            <textarea className="ems-input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label={`New ${label} Price *`}>
            <input className="ems-input" type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
          </Field>
          <Field label="Amendment Currency *">
            <input className="ems-input" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </Field>
          <ReadOnlyField label="Amendment Date" value={new Date().toLocaleString()} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="ems-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ems-btn-primary" disabled={saving} onClick={handleSubmit}>
            Confirm Change
          </button>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
