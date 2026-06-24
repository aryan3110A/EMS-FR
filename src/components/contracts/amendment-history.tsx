'use client';

import type { ContractContainer } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';

type Amendment = {
  id: string;
  incoterm: string;
  previousValue: number;
  amendedValue: number;
  currency: string;
  reason: string;
  amendmentDate: string;
  amendedBy?: { name: string };
};

export function AmendmentHistory({ containers }: { containers: ContractContainer[] }) {
  const rows = containers.flatMap((c) =>
    ((c as ContractContainer & { amendments?: Amendment[] }).amendments ?? []).map((a) => ({
      ...a,
      containerIndex: c.containerIndex,
    })),
  );

  if (!rows.length) return null;

  return (
    <div className="ems-card mt-4 p-5">
      <h3 className="mb-3 font-semibold text-slate-800">CIF/CNF Amendment History</h3>
      <div className="overflow-x-auto">
        <table className="ems-table w-full text-sm">
          <thead>
            <tr>
              <th>Container</th>
              <th>Incoterm</th>
              <th>Original</th>
              <th>Amended</th>
              <th>Reason</th>
              <th>By</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.containerIndex}</td>
                <td>{a.incoterm}</td>
                <td>{a.currency} {formatNumber(a.previousValue, 2)}</td>
                <td>{a.currency} {formatNumber(a.amendedValue, 2)}</td>
                <td>{a.reason}</td>
                <td>{a.amendedBy?.name ?? '—'}</td>
                <td>{formatDate(a.amendmentDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
