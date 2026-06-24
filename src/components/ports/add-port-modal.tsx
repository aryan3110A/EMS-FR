'use client';

import { useState } from 'react';
import { api, Country, Port } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { Field } from '@/components/contracts/form-fields';
import { EmsSelect } from '@/components/ui/ems-select';

type Props = {
  open: boolean;
  countries: Country[];
  onClose: () => void;
  onSaved: (port: Port) => void;
};

export function AddPortModal({ open, countries, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', countryId: '' });

  if (!open) return null;

  async function handleSave() {
    if (!form.name.trim() || !form.countryId) {
      showError('Port Name and Country are required');
      return;
    }
    setSaving(true);
    try {
      const port = await api.masters.createPort({
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        countryId: form.countryId,
      });
      onSaved(port);
      showSuccess('Port saved and selected');
      onClose();
    } catch (e) {
      showError(e, 'Failed to save port');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Add New Port</h2>
        <div className="space-y-3">
          <Field label="Port Name *">
            <input className="ems-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Port Code">
            <input className="ems-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Country *">
            <EmsSelect
              value={form.countryId}
              onChange={(v) => setForm({ ...form, countryId: v })}
              options={countries.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Select country"
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="ems-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ems-btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save & Use Port'}
          </button>
        </div>
      </div>
    </div>
  );
}
