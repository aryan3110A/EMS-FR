'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, type ContainerDashboard, type DashboardContainerItem } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatNumber } from '@/lib/utils';
import { StageBadge } from './stage-badge';

type Bucket = { count: number; containers: DashboardContainerItem[] };

function Tile({
  label,
  bucket,
  tone,
  hint,
  active,
  onClick,
}: {
  label: string;
  bucket: Bucket;
  tone: string;
  hint?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition hover:shadow-sm ${active ? 'ring-2 ring-blue-400' : ''} ${tone}`}
      title={hint}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{bucket.count}</p>
    </button>
  );
}

function List({ title, items, onClose }: { title: string; items: DashboardContainerItem[]; onClose: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <button type="button" className="text-xs text-slate-500 hover:underline" onClick={onClose}>
          Close
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No containers.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="py-1.5">Contract / Container</th>
                <th>Buyer</th>
                <th>Product</th>
                <th>Destination</th>
                <th>Fulfilled</th>
                <th>Stage</th>
                <th>Days since allocation / fulfilment</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.containerId} className="border-b border-slate-50">
                  <td className="py-1.5">
                    <Link href={`/contracts/${c.contractId}/containers#container-${c.containerId}`} className="font-medium text-blue-600 hover:underline">
                      {c.contractNumber} · C{c.containerIndex}
                    </Link>
                    {c.containerNo ? <span className="block font-mono text-xs text-slate-400">{c.containerNo}</span> : null}
                  </td>
                  <td>{c.buyer || '—'}</td>
                  <td>{c.product || '—'}</td>
                  <td>{c.destination || '—'}</td>
                  <td className="tabular-nums">
                    {formatNumber(c.fulfilledKg, 0)} / {formatNumber(c.requiredKg, 0)} KG
                  </td>
                  <td>
                    <StageBadge stage={c.stage} label={c.stageLabel} />
                  </td>
                  <td className="tabular-nums text-slate-600">
                    {c.daysSinceFirstAllocation ?? '—'} / {c.daysSinceFullFulfilment ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Container fulfilment, dispatch and EU/Russia sampling KPIs (ERP Changes 22.11.26 §16, §17, §19). */
export function ContainerKpiPanel({ showAging = true }: { showAging?: boolean }) {
  const { data } = useCachedQuery<ContainerDashboard>('containers:dashboard', () => api.containerDashboard(), { ttl: 30_000 });
  const [open, setOpen] = useState<{ title: string; items: DashboardContainerItem[] } | null>(null);
  if (!data) return <div className="ems-card p-4 text-sm text-slate-500">Loading container status…</div>;

  const c = data.containers;
  const s = data.sampling;
  const toggle = (title: string, b: Bucket) => setOpen((o) => (o?.title === title ? null : { title, items: b.containers }));

  return (
    <div className="space-y-4">
      <div className="ems-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-slate-800">Container Fulfillment &amp; Dispatch</h3>
          <p className="text-xs text-slate-400">
            Unique containers · &quot;Ready for Dispatch&quot; is part of &quot;Fulfilled — Pending Dispatch&quot;
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile label="Not Fulfilled" bucket={c.notFulfilled} tone="border-slate-200 bg-slate-50 text-slate-800" active={open?.title === 'Not Fulfilled'} onClick={() => toggle('Not Fulfilled', c.notFulfilled)} />
          <Tile label="Partially Fulfilled" bucket={c.partiallyFulfilled} tone="border-amber-200 bg-amber-50 text-amber-900" active={open?.title === 'Partially Fulfilled'} onClick={() => toggle('Partially Fulfilled', c.partiallyFulfilled)} />
          <Tile
            label="Fulfilled — Pending Dispatch"
            bucket={c.fulfilledPendingDispatch}
            tone="border-orange-200 bg-orange-50 text-orange-900"
            hint="Fully fulfilled and not yet dispatched (details pending, sampling, or ready)"
            active={open?.title === 'Fulfilled — Pending Dispatch'}
            onClick={() => toggle('Fulfilled — Pending Dispatch', c.fulfilledPendingDispatch)}
          />
          <Tile label="Ready for Dispatch" bucket={c.readyForDispatch} tone="border-emerald-200 bg-emerald-50 text-emerald-900" active={open?.title === 'Ready for Dispatch'} onClick={() => toggle('Ready for Dispatch', c.readyForDispatch)} />
          <Tile label="Dispatched" bucket={c.dispatched} tone="border-slate-700 bg-slate-800 text-white" active={open?.title === 'Dispatched'} onClick={() => toggle('Dispatched', c.dispatched)} />
        </div>
        {c.onHold.count > 0 && (
          <button type="button" className="mt-2 text-xs font-medium text-rose-700 hover:underline" onClick={() => toggle('On Hold', c.onHold)}>
            {c.onHold.count} container(s) on hold
          </button>
        )}
        {open && ['Not Fulfilled', 'Partially Fulfilled', 'Fulfilled — Pending Dispatch', 'Ready for Dispatch', 'Dispatched', 'On Hold'].includes(open.title) && (
          <List title={open.title} items={open.items} onClose={() => setOpen(null)} />
        )}
      </div>

      <div className="ems-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-slate-800">Sampling Status — EU / Russia only</h3>
          <p className="text-xs text-slate-400">
            {s.applicableContainers} container(s) require sampling · {s.notRequiredContainers} do not
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ['Sampling Pending', s.pending, 'border-violet-200 bg-violet-50 text-violet-900'],
              ['Sample Collected / Sent', s.sent, 'border-violet-200 bg-violet-50 text-violet-900'],
              ['Awaiting Results', s.awaitingResult, 'border-violet-200 bg-violet-50 text-violet-900'],
              ['Result Received (approval pending)', s.resultReceived, 'border-indigo-200 bg-indigo-50 text-indigo-900'],
              ['Sampling Approved', s.approved, 'border-emerald-200 bg-emerald-50 text-emerald-900'],
              ['Rejected / On Hold', s.rejectedOnHold, 'border-rose-200 bg-rose-50 text-rose-900'],
            ] as [string, Bucket, string][]
          ).map(([label, bucket, tone]) => (
            <Tile key={label} label={label} bucket={bucket} tone={tone} active={open?.title === label} onClick={() => toggle(label, bucket)} />
          ))}
        </div>
        {open &&
          ['Sampling Pending', 'Sample Collected / Sent', 'Awaiting Results', 'Result Received (approval pending)', 'Sampling Approved', 'Rejected / On Hold'].includes(
            open.title,
          ) && <List title={open.title} items={open.items} onClose={() => setOpen(null)} />}
      </div>

      {showAging && (
        <div className="ems-card p-4">
          <h3 className="mb-1 font-semibold text-slate-800">Container Aging (not yet dispatched)</h3>
          <p className="mb-3 text-xs text-slate-400">Calculated from stored allocation, fulfilment and status-change timestamps.</p>
          {data.aging.length === 0 ? (
            <p className="text-sm text-slate-500">No containers with material assigned are waiting for dispatch.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="py-1.5">Contract / Container</th>
                    <th>Stage</th>
                    <th>Since First Allocation</th>
                    <th>Since Full Fulfillment</th>
                    <th>Waiting for Sampling</th>
                    <th>Awaiting Result</th>
                    <th>Ready for Dispatch</th>
                  </tr>
                </thead>
                <tbody>
                  {data.aging.map((a) => (
                    <tr key={a.containerId} className="border-b border-slate-50">
                      <td className="py-1.5">
                        <Link href={`/contracts/${a.contractId}/containers#container-${a.containerId}`} className="font-medium text-blue-600 hover:underline">
                          {a.contractNumber} · C{a.containerIndex}
                        </Link>
                      </td>
                      <td>
                        <StageBadge stage={a.stage} label={a.stageLabel} />
                      </td>
                      {[a.daysSinceFirstAllocation, a.daysSinceFullFulfilment, a.daysWaitingForSampling, a.daysAwaitingResult, a.daysReadyForDispatch].map(
                        (d, i) => (
                          <td key={i} className="tabular-nums">
                            {d == null ? '—' : `${d} day${d === 1 ? '' : 's'}`}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
