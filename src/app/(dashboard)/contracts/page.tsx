'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/sidebar';
import { api, Contract } from '@/lib/api';
import { formatDate, formatNumber, statusBadge, statusLabel } from '@/lib/utils';
import { Plus, Search } from 'lucide-react';

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.contracts(search ? { search } : undefined)
      .then(setContracts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <AppShell title="Contract Register">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Matches your paper register: Date, Salesperson, Contract No., Buyer, Product, FOB, Freight, CIF
        </p>
        <Link href="/contracts/new" className="ems-btn-primary gap-2">
          <Plus className="h-4 w-4" /> New Contract
        </Link>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="ems-input pl-9"
          placeholder="Search contract, buyer, invoice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="ems-card overflow-x-auto">
        <table className="ems-table w-full min-w-[1200px]">
          <thead>
            <tr>
              <th>A — Date / When we got by</th>
              <th>B — Salesperson</th>
              <th>C — Contract No.</th>
              <th>D — Contract Date</th>
              <th>E — Buyer Lot</th>
              <th>F — Invoice No.</th>
              <th>G — Buyer Name</th>
              <th>H — Product</th>
              <th>I — FOB Price</th>
              <th>J — Freight</th>
              <th>K — CIF Price</th>
              <th>Exchange Rate</th>
              <th>FOB INR/Kg</th>
              <th>MT</th>
              <th>FCL</th>
              <th>Port</th>
              <th>Shipment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={18} className="py-10 text-center text-slate-400">Loading...</td></tr>
            ) : contracts.length === 0 ? (
              <tr><td colSpan={18} className="py-10 text-center text-slate-400">No contracts found</td></tr>
            ) : (
              contracts.map((c) => (
                <tr key={c.id}>
                  <td>{formatDate(c.receivedDate)}</td>
                  <td className="font-medium text-blue-800">{c.salesperson?.name ?? '—'}</td>
                  <td>
                    <Link href={`/contracts/${c.id}`} className="font-semibold text-blue-600 hover:underline">
                      {c.contractNumber}
                    </Link>
                  </td>
                  <td>{formatDate(c.contractDate)}</td>
                  <td>{c.buyerLotNo ?? '—'}</td>
                  <td>{c.invoiceNumber ?? '—'}</td>
                  <td>{c.buyer?.name}</td>
                  <td>{c.product?.code}</td>
                  <td>{formatNumber(c.fobPrice, 0)}</td>
                  <td>{formatNumber(c.freight, 0)}</td>
                  <td>{formatNumber(c.cifPrice, 0)}</td>
                  <td>{formatNumber(c.exchangeRate, 2)}</td>
                  <td>{formatNumber(c.fobInrPerKg, 2)}</td>
                  <td>{c.totalMt}</td>
                  <td>{c.numberOfContainers}</td>
                  <td className="max-w-[140px] truncate">{c.destinationPort?.name ?? '—'}</td>
                  <td>{c.shipmentMonth ?? '—'}</td>
                  <td>
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(c.status)}`}>
                      {statusLabel(c.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
