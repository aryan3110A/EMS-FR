'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/sidebar';
import { PageSpinner } from '@/components/ui/page-loader';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ShieldAlert, Search, History, ArrowLeft, ExternalLink } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('ems_user') || '{}');
      setUserRole(u.role || 'GUEST');
    } catch {
      setUserRole('GUEST');
    }
  }, []);

  useEffect(() => {
    if (userRole === null || !['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(userRole)) return;

    setLoading(true);
    api.allAudits()
      .then((data) => {
        setLogs(data);
      })
      .catch((err) => {
        console.error('Failed to load audit logs', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userRole]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return logs;
    return logs.filter((log) => {
      return (
        (log.user && log.user.toLowerCase().includes(q)) ||
        (log.module && log.module.toLowerCase().includes(q)) ||
        (log.action && log.action.toLowerCase().includes(q)) ||
        (log.contractNumber && log.contractNumber.toLowerCase().includes(q)) ||
        (log.previousValue && log.previousValue.toLowerCase().includes(q)) ||
        (log.newValue && log.newValue.toLowerCase().includes(q))
      );
    });
  }, [logs, searchQuery]);

  if (userRole === null) {
    return (
      <AppShell title="Audit Logs">
        <PageSpinner message="Checking permissions…" />
      </AppShell>
    );
  }

  if (!['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(userRole)) {
    return (
      <AppShell title="Access Denied">
        <div className="ems-card p-5 text-center text-red-500 font-semibold flex flex-col items-center justify-center gap-3">
          <ShieldAlert className="h-10 w-10 text-rose-500 animate-bounce" />
          <p>Access Denied. You do not have permission to view the system audit logs.</p>
          <Link href="/dashboard" className="ems-btn-primary text-xs mt-2">
            Back to Dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="System Audit Logs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>

      {/* Audit Log Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-indigo-500" />
          <h2 className="font-semibold text-slate-800">Change History & Master Audits</h2>
        </div>
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Search by user, contract, action, values..."
            className="ems-input w-full pl-9 pr-4 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="mt-4 ems-card min-h-[300px]">
        {loading ? (
          <PageSpinner message="Loading audit logs..." />
        ) : filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="ems-table w-full">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Contract No.</th>
                  <th>Previous Value</th>
                  <th>New Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-xs text-slate-500">{formatDate(log.timestamp)}</td>
                    <td className="font-semibold text-slate-700">{log.user}</td>
                    <td>
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                        log.type === 'CONTRACT' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {log.module}
                      </span>
                    </td>
                    <td className="text-xs font-medium text-slate-600 uppercase">{log.action}</td>
                    <td>
                      {log.type === 'CONTRACT' ? (
                        <Link
                          href={`/contracts/${log.recordId}`}
                          className="font-bold text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                        >
                          {log.contractNumber} <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="max-w-xs truncate text-xs text-rose-600" title={log.previousValue || ''}>
                      {log.previousValue || '—'}
                    </td>
                    <td className="max-w-xs truncate text-xs text-emerald-600 font-semibold" title={log.newValue || ''}>
                      {log.newValue || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <History className="h-10 w-10 mb-2" />
            <p className="text-sm">No audit logs found.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
