'use client';

import { useState } from 'react';
import { api, Buyer, Country, Port } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { Field } from '@/components/contracts/form-fields';
import { EmsSelect } from '@/components/ui/ems-select';

type Props = {
  open: boolean;
  buyer: Buyer;
  countries: Country[];
  ports: Port[];
  onClose: () => void;
  onSaved: (buyer: Buyer) => void;
};

export function EditBuyerModal({ open, buyer, countries, ports, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: buyer.name,
    code: buyer.code,
    countryId: buyer.country?.id || '',
    euClassification: buyer.euClassification || buyer.country?.euClassification || '',
    defaultPortId: buyer.defaultPort?.id || '',
    address: buyer.address || '',
    contactPerson: buyer.contactPerson || '',
    email: buyer.email || '',
    phone: buyer.phone || '',
  });

  if (!open) return null;

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) {
      showError('Buyer name and code are required');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.masters.updateBuyer(buyer.id, {
        code: form.code.trim().toUpperCase(),
        countryId: form.countryId || undefined,
        euClassification: form.euClassification || undefined,
        defaultPortId: form.defaultPortId || undefined,
        address: form.address || undefined,
        contactPerson: form.contactPerson || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      });
      showSuccess('Buyer updated');
      onSaved(updated);
      onClose();
    } catch (e) {
      showError(e, 'Failed to update buyer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Edit Buyer — {buyer.name}</h2>
        <div className="space-y-3">
          <Field label="Buyer Code *">
            <input className="ems-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Country">
            <EmsSelect
              value={form.countryId}
              onChange={(v) => {
                const c = countries.find((x) => x.id === v);
                setForm({ ...form, countryId: v, euClassification: c?.euClassification ?? form.euClassification });
              }}
              options={countries.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="EU / Non-EU">
            <input className="ems-input" value={form.euClassification} onChange={(e) => setForm({ ...form, euClassification: e.target.value })} />
          </Field>
          <Field label="Default Destination Port">
            <EmsSelect
              value={form.defaultPortId}
              onChange={(v) => setForm({ ...form, defaultPortId: v })}
              options={ports.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Select port"
            />
          </Field>
          <Field label="Address">
            <textarea className="ems-input" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Contact Person">
            <input className="ems-input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className="ems-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="ems-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="ems-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ems-btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
