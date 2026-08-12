'use client';

import { useMemo, useState } from 'react';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { EmsSelect } from '@/components/ui/ems-select';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';

export default function InventoryPage() {
  const [filters, setFilters] = useState({ locationId: '', productId: '', stockCategory: '' });

  const balanceKey = useMemo(
    () => `production:balances:${filters.locationId || 'all'}:${filters.productId || 'all'}:${filters.stockCategory || 'all'}`,
    [filters],
  );
  const ledgerKey = useMemo(
    () => `production:ledger:${filters.productId || 'all'}`,
    [filters.productId],
  );

  const { data: balances } = useCachedQuery(
    balanceKey,
    () => {
      const balanceParams: Record<string, string> = {};
      if (filters.locationId) balanceParams.locationId = filters.locationId;
      if (filters.productId) balanceParams.productId = filters.productId;
      if (filters.stockCategory) balanceParams.stockCategory = filters.stockCategory;
      return api.production.balances(balanceParams);
    },
    { ttl: PRODUCTION_CACHE_TTL },
  );
  const { data: ledger } = useCachedQuery(
    ledgerKey,
    () => {
      const ledgerParams: Record<string, string> = {};
      if (filters.productId) ledgerParams.productId = filters.productId;
      return api.production.ledger(ledgerParams);
    },
    { ttl: PRODUCTION_CACHE_TTL },
  );
  const { data: locations } = useCachedQuery('production:locations', () => api.production.locations(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: products } = useCachedQuery('masters:products', () => api.masters.products(), {
    ttl: PRODUCTION_CACHE_TTL,
  });

  return (
    <ProductionShell title="Inventory" subtitle="Balances and ledger by location / category">
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <EmsSelect
          value={filters.locationId}
          onChange={(v) => setFilters((f) => ({ ...f, locationId: v }))}
          placeholder="Location"
          options={[{ value: '', label: 'All locations' }, ...(locations || []).map((l: any) => ({ value: l.id, label: l.name }))]}
        />
        <EmsSelect
          value={filters.productId}
          onChange={(v) => setFilters((f) => ({ ...f, productId: v }))}
          placeholder="Product"
          options={[{ value: '', label: 'All products' }, ...(products || []).map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
          searchable
        />
        <EmsSelect
          value={filters.stockCategory}
          onChange={(v) => setFilters((f) => ({ ...f, stockCategory: v }))}
          placeholder="Category"
          options={[
            { value: '', label: 'All categories' },
            { value: 'RAW_MATERIAL', label: 'Raw Material' },
            { value: 'PROCESSED_AVAILABLE', label: 'Processed Available' },
            { value: 'SAMPLE_REJECTED', label: 'Sample Rejected' },
            { value: 'WIP_CLEANING', label: 'WIP Cleaning' },
            { value: 'WIP_HULLING', label: 'WIP Hulling' },
            { value: 'STOCK_IN_TRANSIT', label: 'In Transit' },
            { value: 'PROCESSED_RESERVED', label: 'Processed Reserved' },
            { value: 'WASTAGE_BY_PRODUCT', label: 'Wastage' },
          ]}
        />
      </div>

      <div className="ems-card mb-4 p-4">
        <h3 className="mb-3 font-semibold">Balances</h3>
        <table className="ems-table w-full text-sm">
          <thead>
            <tr>
              <th>Location</th>
              <th>Product</th>
              <th>Category</th>
              <th>Qty MT</th>
              <th>Bags</th>
            </tr>
          </thead>
          <tbody>
            {(balances || []).map((b: any) => (
              <tr key={b.id}>
                <td>{b.location?.name}</td>
                <td>{b.product?.name}</td>
                <td>{b.stockCategory?.replace(/_/g, ' ')}</td>
                <td>{formatNumber(Number(b.quantityKg || 0) / 1000, 3)}</td>
                <td>{b.numberOfBags ?? '—'}</td>
              </tr>
            ))}
            {!balances?.length && (
              <tr>
                <td colSpan={5} className="text-slate-400">
                  No balances
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ems-card p-4">
        <h3 className="mb-3 font-semibold">Recent ledger</h3>
        <table className="ems-table w-full text-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Product</th>
              <th>Location</th>
              <th>Qty MT</th>
              <th>Ref</th>
            </tr>
          </thead>
          <tbody>
            {(ledger || []).slice(0, 50).map((e: any) => (
              <tr key={e.id}>
                <td>{formatDate(e.createdAt || e.entryDate)}</td>
                <td>{e.entryType || e.txnType || e.transactionType}</td>
                <td>{e.product?.name}</td>
                <td>{e.location?.name || e.destLocation?.name || e.sourceLocation?.name}</td>
                <td className={Number(e.quantityKg || e.quantityInKg - e.quantityOutKg) < 0 ? 'text-rose-600' : ''}>
                  {formatNumber(Number(e.quantityKg ?? e.quantityInKg - e.quantityOutKg ?? 0) / 1000, 3)}
                </td>
                <td className="text-xs text-slate-500">{e.referenceNumber || e.remarks || '—'}</td>
              </tr>
            ))}
            {!ledger?.length && (
              <tr>
                <td colSpan={6} className="text-slate-400">
                  No ledger entries
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ProductionShell>
  );
}
