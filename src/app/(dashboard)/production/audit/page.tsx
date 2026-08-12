'use client';

import { useMemo, useState } from 'react';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatDate } from '@/lib/utils';

export default function ProductionAuditPage() {
  const [module, setModule] = useState('');
  const [recordNumber, setRecordNumber] = useState('');
  const [applied, setApplied] = useState({ module: '', recordNumber: '' });

  const key = useMemo(
    () => `production:audit:${applied.module || 'all'}:${applied.recordNumber || 'all'}`,
    [applied],
  );

  const { data: rows, loading } = useCachedQuery(
    key,
    () => {
      const params: Record<string, string> = {};
      if (applied.module) params.module = applied.module;
      if (applied.recordNumber) params.recordNumber = applied.recordNumber;
      return api.production.audit(params);
    },
    { ttl: PRODUCTION_CACHE_TTL },
  );

  return (
    <ProductionShell title="Production Audit" subtitle="Immutable production / inventory actions">
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="ems-input"
          placeholder="Module filter"
          value={module}
          onChange={(e) => setModule(e.target.value)}
        />
        <input
          className="ems-input"
          placeholder="Record number"
          value={recordNumber}
          onChange={(e) => setRecordNumber(e.target.value)}
        />
        <button
          type="button"
          className="ems-btn-secondary text-sm"
          onClick={() => setApplied({ module, recordNumber })}
        >
          Filter
        </button>
      </div>

      <div className="ems-card p-4">
        {loading && !rows ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <table className="ems-table w-full text-sm">
            <thead>
              <tr>
                <th>When</th>
                <th>Module</th>
                <th>Action</th>
                <th>Record</th>
                <th>User</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r: any) => (
                <tr key={r.id}>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>{r.module}</td>
                  <td>{r.action}</td>
                  <td>{r.recordNumber || r.recordId || '—'}</td>
                  <td>{r.user?.name || r.userName || '—'}</td>
                  <td className="max-w-xs truncate text-xs text-slate-500">
                    {typeof r.details === 'string' ? r.details : r.details ? JSON.stringify(r.details) : '—'}
                  </td>
                </tr>
              ))}
              {!rows?.length && (
                <tr>
                  <td colSpan={6} className="text-slate-400">
                    No audit entries
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </ProductionShell>
  );
}
