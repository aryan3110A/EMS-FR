'use client';

import { useState } from 'react';
import { api, type ContractContainer } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { EmsSelect } from '@/components/ui/ems-select';
import { formatDate } from '@/lib/utils';

/** PDF §10.4 container statuses (legacy aliases kept for existing rows). */
export const CONTAINER_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'UNDER_PREPARATION', label: 'Under Preparation' },
  { value: 'PRODUCTION_ASSIGNED', label: 'Production Assigned' },
  { value: 'UNDER_PROCESSING', label: 'Under Processing' },
  { value: 'PROCESSING_COMPLETED', label: 'Processing Completed' },
  { value: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch' },
  { value: 'DISPATCHED_FROM_FACTORY', label: 'Dispatched from Factory' },
  { value: 'REACHED_PORT', label: 'Reached Port' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'PLANNED', label: 'Planned (legacy)' },
];

type Props = {
  contractId: string;
  container: ContractContainer;
  canUpdate: boolean;
  onUpdated: () => void;
};

export function ContainerStatusUpdater({ contractId, container, canUpdate, onUpdated }: Props) {
  const [status, setStatus] = useState(container.containerStatus || 'DRAFT');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!status) {
      showError('Select a container status.');
      return;
    }
    if (status === container.containerStatus) {
      showError('Status is unchanged.');
      return;
    }
    setSaving(true);
    try {
      await api.updateContainerStatus(contractId, container.id, {
        status,
        remarks: remarks.trim() || undefined,
      });
      showSuccess('Container status updated');
      setRemarks('');
      onUpdated();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  const history = container.statusHistory ?? [];

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Container Status
      </p>
      {canUpdate && (
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <EmsSelect
            value={status}
            onChange={setStatus}
            options={CONTAINER_STATUS_OPTIONS}
            className="w-full"
          />
          <input
            className="ems-input text-sm"
            placeholder="Remarks (optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          <button
            type="button"
            className="ems-btn-secondary text-xs whitespace-nowrap"
            disabled={saving}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Update Status'}
          </button>
        </div>
      )}
      {history.length > 0 && (
        <ul className="space-y-1.5 text-sm text-slate-700">
          {history.map((h, i) => (
            <li key={i} className="rounded-lg bg-slate-50 px-2 py-1.5">
              <span className="font-medium">
                {(h.fromStatus || '—').replace(/_/g, ' ')} → {h.toStatus.replace(/_/g, ' ')}
              </span>
              <span className="text-slate-500"> · {formatDate(h.createdAt)}</span>
              {h.remarks ? <span className="block text-xs text-slate-500">{h.remarks}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {!history.length && !canUpdate && (
        <p className="text-sm text-slate-500">No status history yet.</p>
      )}
    </div>
  );
}
