'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/sidebar';
import { AddBuyerModal } from '@/components/buyers/add-buyer-modal';
import { EditBuyerModal } from '@/components/buyers/edit-buyer-modal';
import { AddPortModal } from '@/components/ports/add-port-modal';
import { EditPortModal } from '@/components/ports/edit-port-modal';
import { api, Buyer, PackagingType, Port } from '@/lib/api';
import { useCachedQuery, invalidateQueryCache } from '@/lib/use-cached-query';
import { showError, showSuccess } from '@/lib/toast';
import { EmsSelect } from '@/components/ui/ems-select';

export default function MastersPage() {
  const [search, setSearch] = useState('');
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [showPortModal, setShowPortModal] = useState(false);
  const [editBuyer, setEditBuyer] = useState<Buyer | null>(null);
  const [editPort, setEditPort] = useState<Port | null>(null);
  const [showAddPackaging, setShowAddPackaging] = useState(false);
  const [showAddSize, setShowAddSize] = useState(false);
  const [pkgName, setPkgName] = useState('');
  const [pkgMaterial, setPkgMaterial] = useState('');
  const [pkgDescription, setPkgDescription] = useState('');
  const [sizeTypeId, setSizeTypeId] = useState('');
  const [sizeWeight, setSizeWeight] = useState('');
  const [sizeUnit, setSizeUnit] = useState('KG');
  const [sizeLabel, setSizeLabel] = useState('');
  const [sizeDescription, setSizeDescription] = useState('');
  const [savingPkg, setSavingPkg] = useState(false);

  const { data: buyers, loading: buyersLoading } = useCachedQuery(
    `masters:buyers:${search}`,
    () => api.masters.buyers(undefined, search, true),
  );
  const { data: ports } = useCachedQuery('masters:ports:all', () => api.masters.ports(true));
  const { data: countries } = useCachedQuery('masters:countries', () => api.masters.countries());
  const { data: products } = useCachedQuery('masters:products', () => api.masters.products());
  const { data: salespersons } = useCachedQuery('masters:salespersons', () => api.masters.salespersons());
  const { data: packaging } = useCachedQuery('masters:packaging', () => api.masters.packaging());

  const destinationPorts = useMemo(() => (ports ?? []).filter((p) => p.portType !== 'LOADING'), [ports]);

  async function deactivateBuyer(id: string) {
    if (!confirm('Deactivate this buyer? Historical contracts will be preserved.')) return;
    await api.masters.deactivateBuyer(id);
    showSuccess('Buyer deactivated');
    invalidateQueryCache('masters:buyers');
  }

  async function savePackagingType() {
    if (!pkgName.trim()) {
      showError('Packaging name is required');
      return;
    }
    setSavingPkg(true);
    try {
      await api.masters.createPackagingType({
        name: pkgName.trim(),
        material: pkgMaterial.trim() || undefined,
        description: pkgDescription.trim() || undefined,
      });
      showSuccess('Packaging type created');
      setPkgName('');
      setPkgMaterial('');
      setPkgDescription('');
      setShowAddPackaging(false);
      invalidateQueryCache('masters:packaging');
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Failed to create packaging type');
    } finally {
      setSavingPkg(false);
    }
  }

  async function savePackagingSize() {
    if (!sizeTypeId || !sizeWeight) {
      showError('Select packaging type and enter weight');
      return;
    }
    setSavingPkg(true);
    try {
      await api.masters.createPackagingSize({
        packagingTypeId: sizeTypeId,
        weightValue: Number(sizeWeight),
        weightUnit: sizeUnit,
        label: sizeLabel.trim() || undefined,
        description: sizeDescription.trim() || undefined,
      });
      showSuccess('Packaging size created');
      setSizeWeight('');
      setSizeLabel('');
      setSizeDescription('');
      setShowAddSize(false);
      invalidateQueryCache('masters:packaging');
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Failed to create packaging size');
    } finally {
      setSavingPkg(false);
    }
  }

  return (
    <AppShell title="Master Data">
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="ems-input max-w-xs"
          placeholder="Search buyers by name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="ems-btn-primary text-sm" onClick={() => setShowBuyerModal(true)}>
          + Add Buyer
        </button>
        <button type="button" className="ems-btn-secondary text-sm" onClick={() => setShowPortModal(true)}>
          + Add Port
        </button>
        <button type="button" className="ems-btn-secondary text-sm" onClick={() => setShowAddPackaging(true)}>
          + Add Packaging
        </button>
        <button type="button" className="ems-btn-secondary text-sm" onClick={() => setShowAddSize(true)}>
          + Add Packaging Size
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <div className="ems-card p-5 xl:col-span-2">
          <h3 className="mb-3 font-semibold">Buyer Master</h3>
          {buyersLoading && !buyers ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
              <table className="ems-table w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Country</th>
                    <th>Default Port</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(buyers ?? []).map((b) => (
                    <tr key={b.id} className={b.isActive === false ? 'opacity-50' : ''}>
                      <td className="font-medium">{b.code}</td>
                      <td>{b.name}</td>
                      <td>{b.country?.name ?? '—'}</td>
                      <td>{b.defaultPort?.name ?? '—'}</td>
                      <td>{b.isActive === false ? 'Inactive' : 'Active'}</td>
                      <td className="space-x-2 whitespace-nowrap">
                        <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setEditBuyer(b)}>
                          Edit
                        </button>
                        {b.isActive !== false && (
                          <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => deactivateBuyer(b.id)}>
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ems-card p-5 xl:col-span-2">
          <h3 className="mb-3 font-semibold">Port Master</h3>
          <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
            <table className="ems-table w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {destinationPorts.map((p) => (
                  <tr key={p.id} className={p.isActive === false ? 'opacity-50' : ''}>
                    <td>{p.name}</td>
                    <td>{p.code ?? '—'}</td>
                    <td>{p.country?.name ?? '—'}</td>
                    <td>{p.isActive === false ? 'Inactive' : 'Active'}</td>
                    <td>
                      <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setEditPort(p)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ems-card p-5 xl:col-span-2">
          <h3 className="mb-3 font-semibold">Packaging Master</h3>
          <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
            <table className="ems-table w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Material</th>
                  <th>Description</th>
                  <th>Sizes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(packaging ?? []).map((p: PackagingType) => (
                  <tr key={p.id} className={p.isActive === false ? 'opacity-50' : ''}>
                    <td className="font-medium">{p.code}</td>
                    <td>{p.name}</td>
                    <td>{p.material ?? '—'}</td>
                    <td className="max-w-[160px] truncate" title={p.description || ''}>
                      {p.description ?? '—'}
                    </td>
                    <td>
                      {(p.sizes ?? []).length
                        ? (p.sizes ?? []).map((s) => s.label).join(', ')
                        : '—'}
                    </td>
                    <td>{p.isActive === false ? 'Inactive' : 'Active'}</td>
                  </tr>
                ))}
                {!(packaging ?? []).length && (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-400">
                      No packaging types yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ems-card p-5">
          <h3 className="mb-3 font-semibold">Salespersons</h3>
          <ul className="space-y-2 text-sm max-h-60 overflow-y-auto">
            {(salespersons ?? []).map((s) => (
              <li key={s.id} className="rounded-lg bg-slate-50 px-3 py-2">{s.name}</li>
            ))}
          </ul>
        </div>

        <div className="ems-card p-5 lg:col-span-3">
          <h3 className="mb-3 font-semibold">Products</h3>
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {(products ?? []).map((p) => (
              <li key={p.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium">{p.code}</span> — {p.name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {showAddPackaging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Add Packaging Type</h3>
            <div className="space-y-3">
              <input className="ems-input w-full" placeholder="Name *" value={pkgName} onChange={(e) => setPkgName(e.target.value)} />
              <input className="ems-input w-full" placeholder="Material" value={pkgMaterial} onChange={(e) => setPkgMaterial(e.target.value)} />
              <textarea
                className="ems-input w-full min-h-[80px]"
                placeholder="Description"
                value={pkgDescription}
                onChange={(e) => setPkgDescription(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="ems-btn-secondary text-sm" onClick={() => setShowAddPackaging(false)}>
                Cancel
              </button>
              <button type="button" className="ems-btn-primary text-sm" disabled={savingPkg} onClick={savePackagingType}>
                {savingPkg ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddSize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Add Packaging Size</h3>
            <div className="space-y-3">
              <EmsSelect
                value={sizeTypeId}
                onChange={setSizeTypeId}
                options={[
                  { value: '', label: 'Select packaging type' },
                  ...(packaging ?? []).map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <div className="flex gap-2">
                <input
                  className="ems-input w-full"
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Weight *"
                  value={sizeWeight}
                  onChange={(e) => setSizeWeight(e.target.value)}
                />
                <EmsSelect
                  value={sizeUnit}
                  onChange={setSizeUnit}
                  options={[
                    { value: 'KG', label: 'KG' },
                    { value: 'G', label: 'G' },
                  ]}
                />
              </div>
              <input className="ems-input w-full" placeholder="Label (optional)" value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)} />
              <textarea
                className="ems-input w-full min-h-[80px]"
                placeholder="Description"
                value={sizeDescription}
                onChange={(e) => setSizeDescription(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="ems-btn-secondary text-sm" onClick={() => setShowAddSize(false)}>
                Cancel
              </button>
              <button type="button" className="ems-btn-primary text-sm" disabled={savingPkg} onClick={savePackagingSize}>
                {savingPkg ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddBuyerModal open={showBuyerModal} countries={countries ?? []} ports={destinationPorts} onClose={() => setShowBuyerModal(false)} onSaved={() => { invalidateQueryCache('masters:buyers'); setShowBuyerModal(false); }} />
      {editBuyer && (
        <EditBuyerModal open buyer={editBuyer} countries={countries ?? []} ports={destinationPorts} onClose={() => setEditBuyer(null)} onSaved={() => { invalidateQueryCache('masters:buyers'); setEditBuyer(null); }} />
      )}
      <AddPortModal open={showPortModal} countries={countries ?? []} onClose={() => setShowPortModal(false)} onSaved={() => { invalidateQueryCache('masters:ports'); setShowPortModal(false); }} />
      {editPort && countries && (
        <EditPortModal open port={editPort} countries={countries} onClose={() => setEditPort(null)} onSaved={() => { invalidateQueryCache('masters:ports'); setEditPort(null); }} />
      )}
    </AppShell>
  );
}
