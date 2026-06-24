'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type AuditEntry = {
  id: string;
  fieldName: string;
  previousValue?: string | null;
  newValue?: string | null;
  containerIndex?: number | null;
  createdAt: string;
  changedBy?: { name: string };
};

export function AuditLogPanel({ contractId }: { contractId: string }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.contractAudit(contractId)
      .then((data) => setLogs(data as AuditEntry[]))
      .finally(() => setLoading(false));
  }, [contractId]);

  if (loading) return <p className="text-sm text-slate-400">Loading audit log…</p>;
  if (!logs.length) return <p className="text-sm text-slate-400">No audit entries yet.</p>;

  return (
    <div className="max-h-64 overflow-y-auto">
      <table className="ems-table w-full text-sm">
        <thead>
          <tr>
            <th>When</th>
            <th>Field</th>
            <th>Container</th>
            <th>From</th>
            <th>To</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{formatDate(log.createdAt)}</td>
              <td>{log.fieldName}</td>
              <td>{log.containerIndex ?? '—'}</td>
              <td>{log.previousValue ?? '—'}</td>
              <td>{log.newValue ?? '—'}</td>
              <td>{log.changedBy?.name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
