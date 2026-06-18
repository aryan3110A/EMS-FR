'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { showError } from '@/lib/toast';
type InlineAddPanelProps = {
  title: string;
  onSave: (values: Record<string, string>) => Promise<void>;
  onCancel: () => void;
  fields: { key: string; label: string; placeholder?: string; type?: string }[];
};

export function InlineAddPanel({ title, onSave, onCancel, fields }: InlineAddPanelProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ''])),
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (fields.some((f) => !values[f.key]?.trim())) return;
    setSaving(true);
    try {
      await onSave(values);
    } catch (error) {
      showError(error, 'Failed to add');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-900">
          <Plus className="h-4 w-4" /> {title}
        </p>
        <button type="button" onClick={onCancel} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className={fields.length === 1 ? 'sm:col-span-2' : undefined}>
            <label className="ems-label">{f.label}</label>
            <input
              type={f.type || 'text'}
              className="ems-input"
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="ems-btn-secondary text-sm">
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || fields.some((f) => !values[f.key]?.trim())}
          onClick={handleSave}
          className="ems-btn-primary text-sm"
        >
          {saving ? 'Adding...' : 'Add'}
        </button>
      </div>
    </div>
  );
}
