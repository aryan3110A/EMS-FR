'use client';

import { useState } from 'react';
import { api, Port, Country } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { Field } from '@/components/contracts/form-fields';
import { EmsSelect } from '@/components/ui/ems-select';

type Props = {
  open: boolean;
  port: Port;
  countries: Country[];
  onClose: () => void;
  onSaved: (port: Port) => void;
};

export function EditPortModal({ open, port, countries, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: port.name,
    code: port.code || '',
    countryId: port.country?.id || '',
    isActive: port.isActive !== false,
  });

  if (!open) return null;

  async function handleSave() {
    if (!form.name.trim()) {
      showError('Port name is required');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.masters.updatePort(port.id, {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        countryId: form.countryId || undefined,
        isActive: form.isActive,
      });
      showSuccess('Port updated');
      onSaved(updated);
      onClose();
    } catch (e) {
      showError(e, 'Failed to update port');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Edit Port</h2>
        <div className="space-y-3">
          <Field label="Port Name *">
            <input className="ems-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Port Code">
            <input className="ems-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Country">
            <EmsSelect
              value={form.countryId}
              onChange={(v) => setForm({ ...form, countryId: v })}
              options={countries.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Status">
            <EmsSelect
              value={form.isActive ? 'ACTIVE' : 'INACTIVE'}
              onChange={(v) => setForm({ ...form, isActive: v === 'ACTIVE' })}
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="ems-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ems-btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
