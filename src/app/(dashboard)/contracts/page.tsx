'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/sidebar';
import { BuyerContractSearch } from '@/components/contracts/buyer-contract-search';
import { ContractRegisterTable } from '@/components/contracts/contract-register';
import { PageSpinner } from '@/components/ui/page-loader';
import { api } from '@/lib/api';
import { useCachedQuery, invalidateQueryCache } from '@/lib/use-cached-query';
import { Plus } from 'lucide-react';

export default function ContractsPage() {
  const [inputValue, setInputValue] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [fetchMode, setFetchMode] = useState<'search' | 'fetch' | null>(null);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('ems_user') || '{}');
      setUserRole(u.role || '');
    } catch {}
  }, []);

  const canCreate = ['SUPER_ADMIN', 'OFFICE_ADMIN', 'CONTRACT_TEAM'].includes(userRole);

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
          <ContractRegisterTable contracts={list} />
        )}
      </div>
    </AppShell>
  );
}
