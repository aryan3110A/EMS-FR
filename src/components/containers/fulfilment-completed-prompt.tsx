'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { api, type ContainerWorkflowView, type FulfilledContainer } from '@/lib/api';
import { showError } from '@/lib/toast';
import { formatNumber } from '@/lib/utils';
import { ContainerDetailsModal } from './container-details-modal';

/**
 * "Container Fulfillment Completed" prompt (ERP Changes 22.11.26 §8.1). Shown after
 * fulfilment from Production Finalisation or from the Fulfilment tab. The contract and
 * container are already known, so the user never re-selects them.
 */
export function FulfilmentCompletedPrompt({ items, onDone }: { items: FulfilledContainer[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState<ContainerWorkflowView | null>(null);
  const [loading, setLoading] = useState(false);
  const current = items[index];
  if (!current) return null;

  const next = () => {
    setEditing(null);
    if (index + 1 < items.length) setIndex(index + 1);
    else onDone();
  };

  async function openDetails() {
    setLoading(true);
    try {
      const views = await api.containerWorkflow(current.contractId);
      const view = views.find((v) => v.containerId === current.containerId);
      if (!view) throw new Error('Container not found');
      setEditing(view);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Could not open container details');
    } finally {
      setLoading(false);
    }
  }

  if (editing) {
    return <ContainerDetailsModal view={editing} onClose={next} onSaved={next} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-xl">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
        <h3 className="text-lg font-semibold text-slate-800">Container Fulfillment Completed</h3>
        <p className="mt-1 text-sm font-medium text-slate-600">
          {current.contractNumber} · Container {current.containerIndex} · {formatNumber(current.fulfilledKg, 0)} /{' '}
          {formatNumber(current.requiredKg, 0)} KG
        </p>
        <p className="mt-3 text-sm text-slate-600">
          This container has been completely fulfilled. Please update the container and shipping details to proceed
          with the next stage.
        </p>
        {items.length > 1 && (
          <p className="mt-2 text-xs text-slate-400">
            {index + 1} of {items.length} containers
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" className="ems-btn-primary w-full" onClick={openDetails} disabled={loading}>
            {loading ? 'Opening…' : 'Update Container Details'}
          </button>
          <button type="button" className="ems-btn-secondary w-full text-sm" onClick={next}>
            Later — save as &quot;Fulfilled — Container Details Pending&quot;
          </button>
          <Link href={`/contracts/${current.contractId}/containers`} className="text-xs text-blue-600 hover:underline">
            Open Container Status
          </Link>
        </div>
      </div>
    </div>
  );
}
