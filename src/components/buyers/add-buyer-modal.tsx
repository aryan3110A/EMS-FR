'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { api, Buyer, Country, Port } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { Field } from '@/components/contracts/form-fields';
import { EmsSelect } from '@/components/ui/ems-select';
import { AddPortModal } from '@/components/ports/add-port-modal';
import { ADD_OPTION_VALUE } from '@/lib/form-constants';

type Props = {
  open: boolean;
  countries: Country[];
  ports: Port[];
  officeId?: string;
  onClose: () => void;
  onSaved: (buyer: Buyer) => void;
  onPortCreated?: (port: Port) => void;
};

export function AddBuyerModal({ open, countries, ports, officeId, onClose, onSaved, onPortCreated }: Props) {
  const [saving, setSaving] = useState(false);
  const [showPortModal, setShowPortModal] = useState(false);
  const [localPorts, setLocalPorts] = useState<Port[]>([]);
  const [form, setForm] = useState({
    name: '',
    code: '',
    countryId: '',
    euClassification: '',
    defaultPortId: '',
    address: '',
    contactPerson: '',
    email: '',
    phone: '',
    remarks: '',
  });

  if (!open) return null;

  const allPorts = [...ports, ...localPorts.filter((p) => !ports.some((x) => x.id === p.id))];
  const country = countries.find((c) => c.id === form.countryId);

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim() || !form.countryId) {
      showError('Buyer Name, Buyer Code and Country are required');
      return;
    }
    setSaving(true);
    try {
      const buyer = await api.masters.createBuyer({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        countryId: form.countryId,
        officeId,
      });
      const updated = await api.masters.updateBuyer(buyer.id, {
        address: form.address || undefined,
        contactPerson: form.contactPerson || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        euClassification: form.euClassification || country?.euClassification,
        code: form.code.trim().toUpperCase(),
        defaultPortId: form.defaultPortId || undefined,
      });
      const selectedCountry = updated.country ?? (country
        ? { id: country.id, name: country.name, code: country.code, euClassification: country.euClassification }
        : undefined);
      onSaved({
        ...updated,
        country: selectedCountry,
        defaultPort: updated.defaultPort ?? allPorts.find((p) => p.id === form.defaultPortId),
      });
      showSuccess('Buyer saved and selected');
      onClose();
    } catch (e) {
      showError(e, 'Failed to save buyer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Add New Buyer</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-3">
            <Field label="Buyer Name *">
              <input className="ems-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Buyer Code *">
              <input className="ems-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <p className="mt-1 text-xs text-slate-500">
                Buyer Code is a unique identifier assigned to each buyer. It can be added while creating the buyer and updated later from Buyer Master.
              </p>
            </Field>
            <Field label="Country *">
              <EmsSelect
                searchable
                value={form.countryId}
                onChange={(v) => {
                  const c = countries.find((x) => x.id === v);
                  setForm({ ...form, countryId: v, euClassification: c?.euClassification ?? '' });
                }}
                options={countries.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select country"
              />
            </Field>
            <Field label="EU / Non-EU">
              <input className="ems-input" value={form.euClassification} onChange={(e) => setForm({ ...form, euClassification: e.target.value })} />
            </Field>
            <Field label="Default Destination Port">
              <EmsSelect
                searchable
                value={form.defaultPortId}
                onChange={(v) => {
                  if (v === ADD_OPTION_VALUE) {
                    setShowPortModal(true);
                    return;
                  }
                  setForm({ ...form, defaultPortId: v });
                }}
                addOptionValue={ADD_OPTION_VALUE}
                onAddSelect={() => setShowPortModal(true)}
                options={[
                  { value: '', label: 'Select port' },
                  ...allPorts.map((p) => ({ value: p.id, label: p.name })),
                  { value: ADD_OPTION_VALUE, label: '+ Add New Port' },
                ]}
                placeholder="Select port"
              />
            </Field>
            <Field label="Buyer Address">
              <textarea className="ems-input" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Contact Person">
              <input className="ems-input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </Field>
            <Field label="Buyer Email">
              <input className="ems-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Buyer Phone">
              <input className="ems-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Buyer Remarks">
              <textarea className="ems-input" rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" className="ems-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ems-btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save & Use Buyer'}
          </button>
        </div>
      </div>

      <AddPortModal
        open={showPortModal}
        countries={countries}
        onClose={() => setShowPortModal(false)}
        onSaved={(port) => {
          setLocalPorts((prev) => [...prev, port]);
          setForm((f) => ({ ...f, defaultPortId: port.id }));
          onPortCreated?.(port);
          setShowPortModal(false);
          showSuccess('Port saved and selected for buyer');
        }}
      />
    </div>
  );
}
