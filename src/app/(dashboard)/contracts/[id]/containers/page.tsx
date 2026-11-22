'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/sidebar';
import { ContainerWorkflowCard } from '@/components/containers/container-workflow-card';
import { StageBadge } from '@/components/containers/stage-badge';
import { api, type ContainerWorkflowView } from '@/lib/api';
import { invalidateQueryCache } from '@/lib/use-cached-query';
import { formatNumber } from '@/lib/utils';

/** Contracts → Actions → Container Status (ERP Changes 22.11.26 §6, §14). */
export default function ContainerStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [views, setViews] = useState<ContainerWorkflowView[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setViews(await api.containerWorkflow(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load container status');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (updated: ContainerWorkflowView) => {
    invalidateQueryCache(`contract:${id}`);
    // Reload all so history and sibling data stay exact; the card already shows the new stage.
    setViews((prev) => (prev ? prev.map((v) => (v.containerId === updated.containerId ? { ...updated, history: v.history } : v)) : prev));
    void load();
  };

  const contractNumber = views?.[0]?.contract.contractNumber;

  return (
    <AppShell title="Container Status" subtitle={contractNumber ? `Contract ${contractNumber}` : undefined}>
      <div className="my-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/contracts/${id}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to contract
        </Link>
        <button type="button" className="ems-btn-secondary inline-flex items-center gap-1 text-xs" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!views && !error && <p className="py-8 text-center text-sm text-slate-500">Loading container status…</p>}
      {views && views.length === 0 && <p className="py-8 text-center text-sm text-slate-500">This contract has no containers.</p>}

      {views && views.length > 1 && (
        <div className="ems-card mb-4 overflow-x-auto p-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="py-1.5">Container</th>
                <th>Fulfilled / Required</th>
                <th>Sampling</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {views.map((v) => (
                <tr key={v.containerId} className="border-b border-slate-50">
                  <td className="py-1.5">
                    <a href={`#container-${v.containerId}`} className="font-medium text-blue-600 hover:underline">
                      Container {v.containerIndex}
                    </a>
                  </td>
                  <td>
                    {formatNumber(v.fulfilment.fulfilledKg, 0)} / {formatNumber(v.fulfilment.requiredKg, 0)} KG
                  </td>
                  <td className="text-xs text-slate-600">{v.sampling.required ? 'Required' : 'Not required'}</td>
                  <td>
                    <StageBadge stage={v.stage} label={v.stageLabel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-4 pb-8">
        {views?.map((v) => <ContainerWorkflowCard key={v.containerId} view={v} onChanged={replace} />)}
      </div>
    </AppShell>
  );
}
