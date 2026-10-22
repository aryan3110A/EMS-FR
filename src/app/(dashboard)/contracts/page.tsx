'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/sidebar';
import { BuyerContractSearch } from '@/components/contracts/buyer-contract-search';
import { ContractRegisterTable } from '@/components/contracts/contract-register';
import { PageSpinner } from '@/components/ui/page-loader';
import { api, type Contract } from '@/lib/api';
import { useCachedQuery, invalidateQueryCache } from '@/lib/use-cached-query';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { statusLabel } from '@/lib/utils';

export default function ContractsPage() {
  const [inputValue, setInputValue] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [fetchMode, setFetchMode] = useState<'search' | 'fetch' | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('ems_user') || '{}');
      setUserRole(u.role || '');
    } catch {}
  }, []);

  const canCreate = ['SUPER_ADMIN', 'OFFICE_ADMIN', 'CONTRACT_TEAM', 'SUPER_SALES'].includes(userRole);
  const canDelete = ['SUPER_ADMIN', 'OFFICE_ADMIN', 'CONTRACT_TEAM', 'SUPER_SALES'].includes(userRole);

  const { data: buyers } = useCachedQuery('masters:buyers', () => api.masters.buyers());

  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveSearch(inputValue.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const cacheKey = activeSearch ? `contracts:buyer:${activeSearch}` : 'contracts:all';

  const { data: contracts, loading, refresh } = useCachedQuery(cacheKey, () =>
    api.contracts(activeSearch ? { search: activeSearch } : undefined),
  );

  const isTyping = inputValue.trim() !== activeSearch;
  const isSearching = isTyping || loading;
  const list = contracts ?? [];

  useEffect(() => {
    if (!isSearching) setFetchMode(null);
  }, [isSearching]);

  useEffect(() => {
    if (fetchMode === 'fetch' && activeSearch) {
      refresh();
    }
  }, [fetchMode, activeSearch, refresh]);

  const handleSelectBuyer = (name: string) => {
    setFetchMode('fetch');
    invalidateQueryCache(`contracts:buyer:${name}`);
    setInputValue(name);
    setActiveSearch(name);
  };

  const handleDeleteContract = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteContract(deleteTarget.id);
      showSuccess(`Contract ${deleteTarget.contractNumber} deleted successfully`);
      invalidateQueryCache(cacheKey);
      invalidateQueryCache('contracts:all');
      invalidateQueryCache(`contract:${deleteTarget.id}`);
      setDeleteTarget(null);
      refresh();
    } catch (e: any) {
      showError(e?.message || 'Failed to delete contract');
    } finally {
      setDeleting(false);
    }
  };

  const loadingMessage =
    fetchMode === 'fetch' ? 'Fetching details...' : 'Loading contracts...';

  return (
    <AppShell title="Contract Register">
      {canCreate && (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
          <Link href="/contracts/new" className="ems-btn-primary gap-2">
            <Plus className="h-4 w-4" /> New Contract
          </Link>
        </div>
      )}

      <BuyerContractSearch
        value={inputValue}
        buyers={buyers ?? []}
        onChange={(value) => {
          setInputValue(value);
          setFetchMode('search');
        }}
        onSelectBuyer={handleSelectBuyer}
      />

      <div className="ems-card min-h-[200px]">
        {isSearching ? (
          <PageSpinner message={loadingMessage} />
        ) : (
          <ContractRegisterTable
            contracts={list}
            onDelete={(contract) => setDeleteTarget(contract)}
            canDelete={canDelete}
          />
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-red-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Contract</h3>
                <p className="text-xs text-slate-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="my-4 rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Contract Number:</span>
                <span className="font-bold text-slate-800">{deleteTarget.contractNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Buyer:</span>
                <span className="font-semibold text-slate-700">{deleteTarget.buyer?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Quantity:</span>
                <span className="font-semibold text-slate-700">
                  {deleteTarget.totalMt} MT ({deleteTarget.numberOfContainers} FCL)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Status:</span>
                <span className="font-semibold text-slate-700">{statusLabel(deleteTarget.status)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete Contract <span className="font-bold text-slate-900">{deleteTarget.contractNumber}</span>? 
              All associated lots, containers, commercial logs, and allocations will be removed, and allocated material will be restored to available inventory.
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                className="ems-btn-secondary text-sm px-4 py-2"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                onClick={handleDeleteContract}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Deleting…' : 'Delete Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
