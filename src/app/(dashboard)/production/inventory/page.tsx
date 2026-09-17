'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { EmsSelect } from '@/components/ui/ems-select';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

const CATEGORY_FILTERS = [
  { value: '', label: 'All Categories' },
  { value: 'rawKg', label: 'Raw Material' },
  { value: 'wipKg', label: 'WIP' },
  { value: 'processedKg', label: 'Processed' },
  { value: 'wastageKg', label: 'Wastage' },
  { value: 'rejectedKg', label: 'Sampling-Rejected' },
] as const;

export default function InventoryPage() {
  const [locationId, setLocationId] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const { data: locations } = useCachedQuery('production:locations', () => api.production.locations(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: products } = useCachedQuery(
    `inventory:by-product:${locationId || 'all'}`,
    () => api.production.inventoryByProduct(locationId || undefined),
    { ttl: PRODUCTION_CACHE_TTL },
  );
  const { data: detail } = useCachedQuery(
    detailId ? `inventory:detail:${detailId}:${locationId || 'all'}` : 'inventory:detail:none',
    () =>
      detailId
        ? api.production.inventoryProductDetail(detailId, locationId || undefined)
        : Promise.resolve(null),
    { ttl: PRODUCTION_CACHE_TTL, enabled: !!detailId },
  );
  const { data: ledger } = useCachedQuery('production:ledger', () => api.production.ledger(), {
    ttl: PRODUCTION_CACHE_TTL,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products || []).filter((p: any) => {
      if (q && !p.productName?.toLowerCase().includes(q) && !p.productCode?.toLowerCase().includes(q)) {
        return false;
      }
      if (category && !(Number(p[category]) > 0)) return false;
      return true;
    });
  }, [products, search, category]);

  const displayKg = (p: any) => {
    if (!category) return p.totalKg;
    return Number(p[category]) || 0;
  };

  if (detailId && detail) {
    const locs = detail.locations || [];
    const total = locs.reduce((s: number, l: any) => s + l.totalKg, 0) || 1;
    return (
      <ProductionShell title={detail.product?.name || 'Inventory Detail'} subtitle="Location × category breakdown">
        <button type="button" className="mb-4 text-sm text-blue-600" onClick={() => setDetailId(null)}>
          ← Back to products
        </button>
        <div className="ems-card mb-4 overflow-x-auto p-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">Location</th>
                <th>Raw</th>
                <th>WIP</th>
                <th>Processed</th>
                <th>Wastage</th>
                <th>Sampling Rejected</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {locs.map((l: any) => (
                <tr key={l.locationId} className="border-b border-slate-100">
                  <td className="py-2 font-medium">{l.locationName}</td>
                  <td>{formatNumber(l.rawKg, 0)}</td>
                  <td>{formatNumber(l.wipKg, 0)}</td>
                  <td>{formatNumber(l.processedKg, 0)}</td>
                  <td title={JSON.stringify(detail.wastageByType || {})}>{formatNumber(l.wastageKg, 0)}</td>
                  <td>{formatNumber(l.rejectedKg, 0)}</td>
                  <td className="font-semibold">{formatNumber(l.totalKg, 0)} KG</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <div className="ems-card p-4">
            <h3 className="mb-3 font-semibold">Stock composition</h3>
            {['rawKg', 'wipKg', 'processedKg', 'wastageKg', 'rejectedKg'].map((key) => {
              const label: Record<string, string> = {
                rawKg: 'Raw',
                wipKg: 'WIP',
                processedKg: 'Processed',
                wastageKg: 'Wastage',
                rejectedKg: 'Sampling-Rejected',
              };
              const val = locs.reduce((s: number, l: any) => s + (l[key] || 0), 0);
              const pct = Math.round((val / total) * 100);
              return (
                <div key={key} className="mb-2">
                  <div className="mb-0.5 flex justify-between text-xs">
                    <span>{label[key]}</span>
                    <span>
                      {formatNumber(val, 0)} KG ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="ems-card p-4">
            <h3 className="mb-3 font-semibold">Location distribution</h3>
            {locs.map((l: any) => {
              const pct = Math.round((l.totalKg / total) * 100);
              return (
                <div key={l.locationId} className="mb-2">
                  <div className="mb-0.5 flex justify-between text-xs">
                    <span>{l.locationName}</span>
                    <span>
                      {formatNumber(l.totalKg, 0)} KG ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {detail.wastageByType && Object.keys(detail.wastageByType).length > 0 && (
          <div className="ems-card mb-4 p-4">
            <h3 className="mb-2 font-semibold">Wastage by type</h3>
            <ul className="text-sm">
              {Object.entries(detail.wastageByType).map(([name, qty]) => (
                <li key={name} className="flex justify-between border-b border-slate-50 py-1">
                  <span>{name}</span>
                  <span>{formatNumber(qty as number, 0)} KG</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(detail.ledger || []).length > 0 && (
          <div className="ems-card mb-4 p-4">
            <h3 className="mb-3 font-semibold">Historical inventory movement (from ledger)</h3>
            <p className="mb-2 text-xs text-slate-500">Same quantities as ledger table · recent transactions</p>
            <div className="space-y-1.5">
              {[...(detail.ledger || [])]
                .slice(0, 12)
                .reverse()
                .map((row: any) => {
                  const net = (row.quantityInKg || 0) - (row.quantityOutKg || 0);
                  const mag = Math.min(100, Math.abs(net) / 10);
                  return (
                    <div key={row.id} className="flex items-center gap-2 text-xs">
                      <span className="w-20 shrink-0 text-slate-500">{formatDate(row.createdAt)}</span>
                      <div className="flex h-2 flex-1 overflow-hidden rounded bg-slate-100">
                        <div
                          className={net >= 0 ? 'h-full bg-emerald-500' : 'h-full bg-rose-500'}
                          style={{ width: `${Math.max(4, mag)}%` }}
                        />
                      </div>
                      <span className={`w-24 shrink-0 text-right tabular-nums ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {net >= 0 ? '+' : ''}
                        {formatNumber(net, 0)} KG
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="ems-card p-4">
          <h3 className="mb-2 font-semibold">Recent ledger (KG)</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Date</th>
                  <th>Type</th>
                  <th>Ref</th>
                  <th>Location</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Balance</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {(detail.ledger || []).slice(0, 40).map((row: any) => (
                  <tr key={row.id} className="border-b border-slate-50">
                    <td className="py-1.5">{formatDate(row.createdAt)}</td>
                    <td>{row.txnType?.replace(/_/g, ' ')}</td>
                    <td className="font-mono text-xs">{row.referenceId?.slice(0, 8) || '—'}</td>
                    <td>{row.destLocation?.name || row.sourceLocation?.name || '—'}</td>
                    <td className="text-emerald-700">
                      {row.quantityInKg ? `+${formatNumber(row.quantityInKg, 0)}` : '—'}
                    </td>
                    <td className="text-rose-700">
                      {row.quantityOutKg ? `-${formatNumber(row.quantityOutKg, 0)}` : '—'}
                    </td>
                    <td>{row.balanceKg != null ? formatNumber(row.balanceKg, 0) : '—'}</td>
                    <td>{row.createdBy?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ProductionShell>
    );
  }

  return (
    <ProductionShell title="Inventory" subtitle="One row per product · totals in KG">
      <div className="mb-4 flex flex-wrap gap-2">
        <EmsSelect
          value={locationId}
          onChange={setLocationId}
          placeholder="Location"
          options={[
            { value: '', label: 'All Locations' },
            ...(locations || []).map((l: any) => ({ value: l.id, label: l.name })),
          ]}
        />
        <EmsSelect
          value={category}
          onChange={setCategory}
          placeholder="Category"
          options={[...CATEGORY_FILTERS]}
        />
        <input
          className="ems-input max-w-xs"
          placeholder="Search product"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Link href="/production/wastage" className="ems-btn-secondary text-sm">
          Wastage Inventory
        </Link>
      </div>

      <div className="ems-card overflow-visible p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">{category ? 'Filtered Stock' : 'Total Tracked Stock'}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => (
              <tr
                key={p.productId}
                className="relative cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                onMouseEnter={() => setHoverId(p.productId)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => setDetailId(p.productId)}
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{p.productName}</p>
                  <p className="text-xs text-slate-400">{p.productCode}</p>
                </td>
                <td className="relative px-4 py-3 font-semibold tabular-nums">
                  {formatNumber(displayKg(p), 0)} KG
                  {hoverId === p.productId && (
                    <div className="absolute right-4 top-full z-20 mt-1 w-56 rounded-lg border bg-white p-3 text-xs font-normal shadow-lg">
                      <p className="mb-1 font-semibold">{p.productName}</p>
                      <p>Raw: {formatNumber(p.rawKg, 0)} KG</p>
                      <p>Processed: {formatNumber(p.processedKg, 0)} KG</p>
                      <p>Wastage: {formatNumber(p.wastageKg, 0)} KG</p>
                      <p>Sampling-Rejected: {formatNumber(p.rejectedKg, 0)} KG</p>
                      <p>WIP: {formatNumber(p.wipKg, 0)} KG</p>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  No inventory
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ems-card mt-4 p-4">
        <h3 className="mb-2 font-semibold">Recent Ledger (KG)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">Date</th>
                <th>Product</th>
                <th>Type</th>
                <th>Ref</th>
                <th>Location</th>
                <th>Qty In</th>
                <th>Qty Out</th>
                <th>Balance</th>
                <th>User</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {(ledger || []).slice(0, 30).map((row: any) => (
                <tr key={row.id} className="border-b border-slate-50">
                  <td className="py-1.5">{formatDate(row.createdAt)}</td>
                  <td>{row.product?.name}</td>
                  <td>{row.txnType?.replace(/_/g, ' ')}</td>
                  <td className="font-mono text-xs">{row.referenceId?.slice(0, 8) || '—'}</td>
                  <td>{row.destLocation?.name || row.sourceLocation?.name || '—'}</td>
                  <td>{row.quantityInKg ? `+${formatNumber(row.quantityInKg, 0)}` : '—'}</td>
                  <td>{row.quantityOutKg ? `-${formatNumber(row.quantityOutKg, 0)}` : '—'}</td>
                  <td>{row.balanceKg != null ? formatNumber(row.balanceKg, 0) : '—'}</td>
                  <td>{row.createdBy?.name || '—'}</td>
                  <td className="max-w-[160px] truncate text-slate-500">{row.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ProductionShell>
  );
}
