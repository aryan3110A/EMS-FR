'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { EmsSelect } from '@/components/ui/ems-select';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';

export default function NewJobWorkPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    jobWorkerId: '',
    sourceLocationId: '',
    productId: '',
    processType: 'SORTEX',
    startDate: new Date().toISOString().slice(0, 10),
    remarks: '',
  });

  const { data: workers } = useCachedQuery('jw:workers', () => api.production.jobWork.workers(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: locations } = useCachedQuery('production:locations', () => api.production.locations(), {
    ttl: PRODUCTION_CACHE_TTL,
  });
  const { data: products } = useCachedQuery('masters:products', () => api.masters.products(), {
    ttl: PRODUCTION_CACHE_TTL,
  });

  const selectedProduct = useMemo(
    () => (products || []).find((p: any) => p.id === form.productId),
    [products, form.productId],
  );

  useEffect(() => {
    if (selectedProduct?.allowsFullProcess === false && form.processType === 'FULL_PROCESS') {
      setForm((f) => ({ ...f, processType: 'SORTEX' }));
    }
  }, [selectedProduct, form.processType]);

  async function submit() {
    setSaving(true);
    try {
      const created = await api.production.jobWork.create(form);
      showSuccess(`Job Work ${created.jobWorkNumber} created`);
      invalidateQueryCache('production:');
      router.push(`/production/job-work/${created.id}`);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Failed to create Job Work');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProductionShell title="New Job Work" subtitle="Create a Job Work processing cycle">
      <div className="ems-card max-w-lg space-y-3 p-4">
        <EmsSelect
          value={form.jobWorkerId}
          onChange={(v) => setForm((f) => ({ ...f, jobWorkerId: v }))}
          placeholder="Job Worker / Party *"
          options={[
            { value: '', label: 'Select worker' },
            ...(workers || []).map((w: any) => ({ value: w.id, label: w.name })),
          ]}
        />
        <EmsSelect
          value={form.sourceLocationId}
          onChange={(v) => setForm((f) => ({ ...f, sourceLocationId: v }))}
          placeholder="Source factory / location *"
          options={[
            { value: '', label: 'Select location' },
            ...(locations || []).map((l: any) => ({ value: l.id, label: l.name })),
          ]}
        />
        <EmsSelect
          value={form.productId}
          onChange={(v) => setForm((f) => ({ ...f, productId: v }))}
          placeholder="Product *"
          options={[
            { value: '', label: 'Select product' },
            ...(products || []).map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
          ]}
          searchable
        />
        <EmsSelect
          value={form.processType}
          onChange={(v) => setForm((f) => ({ ...f, processType: v }))}
          placeholder="Process type"
          options={
            selectedProduct?.allowsFullProcess === false
              ? [{ value: 'SORTEX', label: 'Sortex' }]
              : [
                  { value: 'SORTEX', label: 'Sortex' },
                  { value: 'FULL_PROCESS', label: 'Full Process' },
                ]
          }
        />
        <input
          className="ems-input w-full"
          type="date"
          value={form.startDate}
          onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
        />
        <textarea
          className="ems-input w-full min-h-[60px]"
          placeholder="Remarks"
          value={form.remarks}
          onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
        />
        <button type="button" className="ems-btn-primary text-sm" disabled={saving} onClick={submit}>
          {saving ? 'Creating…' : 'Create Job Work'}
        </button>
      </div>
    </ProductionShell>
  );
}
