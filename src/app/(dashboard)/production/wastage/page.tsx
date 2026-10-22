'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductionShell, PRODUCTION_CACHE_TTL } from '@/components/production/production-shell';
import { api } from '@/lib/api';
import { showError, showSuccess } from '@/lib/toast';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber } from '@/lib/utils';
import { Merge, Truck, FileText, CheckSquare, Square } from 'lucide-react';

export default function WastageInventoryPage() {
  const router = useRouter();
  const [starting, setStarting] = useState<string | null>(null);
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);

  // Merge modal state
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [targetLotNumber, setTargetLotNumber] = useState('');
  const [mergeRemarks, setMergeRemarks] = useState('');
  const [merging, setMerging] = useState(false);

  // Outward modal state
  const [outwardModalOpen, setOutwardModalOpen] = useState(false);
  const [outwardLotId, setOutwardLotId] = useState('');
  const [outwardQty, setOutwardQty] = useState<number | ''>('');
  const [truckNumber, setTruckNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [outwardDate, setOutwardDate] = useState(new Date().toISOString().slice(0, 10));
  const [outwardRemarks, setOutwardRemarks] = useState('');
  const [savingOutward, setSavingOutward] = useState(false);

  // Yearly truck report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [truckReport, setTruckReport] = useState<any[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  const { data: lots, refresh } = useCachedQuery(
    'production:wastage-lots',
    () => api.production.wastageLots(),
    { ttl: PRODUCTION_CACHE_TTL },
  );
  const { data: alerts } = useCachedQuery('production:dashboard', () => api.production.dashboard(), {
    ttl: PRODUCTION_CACHE_TTL,
  });

  const selectedLots = (lots || []).filter((l: any) => selectedLotIds.includes(l.id));
  const selectedProductIds = Array.from(new Set(selectedLots.map((l: any) => l.productId)));
  const sameProductSelected = selectedProductIds.length <= 1;
  const totalSelectedKg = selectedLots.reduce((s: number, l: any) => s + (l.availableKg || 0), 0);

  function toggleSelectAll() {
    if (selectedLotIds.length === (lots || []).length) {
      setSelectedLotIds([]);
    } else {
      setSelectedLotIds((lots || []).map((l: any) => l.id));
    }
  }

  function toggleLot(id: string) {
    setSelectedLotIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function openMergeModal() {
    if (selectedLotIds.length < 2) {
      showError('Please select at least 2 wastage lots to merge');
      return;
    }
    if (!sameProductSelected) {
      showError('All selected lots must belong to the same product to be merged');
      return;
    }
    setTargetLotNumber('');
    setMergeRemarks('');
    setMergeModalOpen(true);
  }

  async function handleConfirmMerge() {
    if (selectedLotIds.length < 2) return;
    setMerging(true);
    try {
      const res = await api.production.mergeWastageLots({
        sourceLotIds: selectedLotIds,
        targetLotNumber: targetLotNumber.trim() || undefined,
        remarks: mergeRemarks.trim() || undefined,
      });
      showSuccess(`Merged ${selectedLotIds.length} lots into ${res.lotNumber} (${formatNumber(res.availableKg, 0)} KG)`);
      setMergeModalOpen(false);
      setSelectedLotIds([]);
      invalidateQueryCache('production:');
      await refresh();
    } catch (e: any) {
      showError(e?.message || 'Failed to merge wastage lots');
    } finally {
      setMerging(false);
    }
  }

  function openOutwardModal(lotId?: string) {
    const idToUse = lotId || (selectedLotIds.length === 1 ? selectedLotIds[0] : (lots || [])[0]?.id || '');
    const lot = (lots || []).find((l: any) => l.id === idToUse);
    setOutwardLotId(idToUse);
    setOutwardQty(lot?.availableKg || '');
    setTruckNumber('');
    setDriverName('');
    setBuyerName('');
    setOutwardRemarks('');
    setOutwardDate(new Date().toISOString().slice(0, 10));
    setOutwardModalOpen(true);
  }

  async function handleRecordOutward() {
    if (!outwardLotId) {
      showError('Please select a wastage lot');
      return;
    }
    if (!outwardQty || Number(outwardQty) <= 0) {
      showError('Please enter a valid outward quantity in KG');
      return;
    }
    if (!truckNumber.trim()) {
      showError('Truck / Vehicle number is required');
      return;
    }
    setSavingOutward(true);
    try {
      const res = await api.production.recordWastageOutward({
        wastageLotId: outwardLotId,
        quantityKg: Number(outwardQty),
        truckNumber: truckNumber.trim(),
        driverName: driverName.trim() || undefined,
        buyerName: buyerName.trim() || undefined,
        outwardDate,
        remarks: outwardRemarks.trim() || undefined,
      });
      showSuccess(`Wastage outward recorded: ${formatNumber(res.quantityKg, 0)} KG dispatched on ${res.truckNumber}`);
      setOutwardModalOpen(false);
      invalidateQueryCache('production:');
      await refresh();
    } catch (e: any) {
      showError(e?.message || 'Failed to record outward');
    } finally {
      setSavingOutward(false);
    }
  }

  async function openYearlyReport() {
    setReportModalOpen(true);
    setLoadingReport(true);
    try {
      const data = await api.production.wastageTruckReport({ year: reportYear });
      setTruckReport(data || []);
    } catch (e: any) {
      showError(e?.message || 'Failed to fetch truck report');
    } finally {
      setLoadingReport(false);
    }
  }

  async function reloadYearlyReport(year: number) {
    setReportYear(year);
    setLoadingReport(true);
    try {
      const data = await api.production.wastageTruckReport({ year });
      setTruckReport(data || []);
    } catch (e: any) {
      showError(e?.message || 'Failed to fetch truck report');
    } finally {
      setLoadingReport(false);
    }
  }

  async function startSortex(lot: any) {
    setStarting(lot.id);
    try {
      const created = await api.production.startRun({
        plantId: lot.locationId,
        processType: 'SORTEX',
        productId: lot.productId,
        stockCategory: 'WASTAGE_INVENTORY',
        wastageLotId: lot.id,
        quantity: lot.availableKg,
        unit: 'KG',
        startDate: new Date().toISOString().slice(0, 10),
        remarks: `Reprocess wastage ${lot.lotNumber}`,
      });
      showSuccess(`Sortex ${created.productionNumber} started from wastage`);
      invalidateQueryCache('production:');
      router.push(`/production/runs/${created.id}`);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Failed to start Sortex');
    } finally {
      setStarting(null);
    }
  }

  async function discard(lot: any) {
    const reason = window.prompt('Reason for discard?');
    if (reason == null) return;
    try {
      await api.production.discardWastageLot(lot.id, { reason });
      showSuccess('Wastage discarded');
      invalidateQueryCache('production:');
      await refresh();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Discard failed');
    }
  }

  const selectedLotForOutward = (lots || []).find((l: any) => l.id === outwardLotId);

  return (
    <ProductionShell title="Wastage Inventory" subtitle="Manage wastage lots · Merge lots · Outward dispatches & Reprocessing">
      {(alerts?.wastageAlerts || []).length > 0 && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          High wastage alerts: {alerts.wastageAlerts.length} run(s)
        </div>
      )}

      {/* Action Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ems-btn-secondary text-xs gap-1.5"
            onClick={toggleSelectAll}
          >
            {selectedLotIds.length === (lots || []).length && (lots || []).length > 0 ? (
              <CheckSquare className="h-4 w-4 text-blue-600" />
            ) : (
              <Square className="h-4 w-4 text-slate-400" />
            )}
            Select All ({selectedLotIds.length})
          </button>
          {selectedLotIds.length >= 2 && (
            <button
              type="button"
              className="ems-btn-primary text-xs gap-1.5"
              onClick={openMergeModal}
            >
              <Merge className="h-4 w-4" />
              Merge Selected ({selectedLotIds.length} lots · {formatNumber(totalSelectedKg, 0)} KG)
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ems-btn-secondary text-xs gap-1.5"
            onClick={() => openOutwardModal()}
          >
            <Truck className="h-4 w-4 text-slate-600" />
            Wastage Outward
          </button>
          <button
            type="button"
            className="ems-btn-secondary text-xs gap-1.5"
            onClick={openYearlyReport}
          >
            <FileText className="h-4 w-4 text-slate-600" />
            Yearly Trucks Report
          </button>
        </div>
      </div>

      <div className="ems-card overflow-x-auto p-0">
        <table className="w-full min-w-[950px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-500">
              <th className="w-10 px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={selectedLotIds.length > 0 && selectedLotIds.length === (lots || []).length}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="px-3 py-2">Lot</th>
              <th>Product</th>
              <th>Type</th>
              <th>Location</th>
              <th>Available</th>
              <th>Cycle</th>
              <th>Source / Origin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(lots || []).map((l: any) => {
              const isSelected = selectedLotIds.includes(l.id);
              const isMerged = !!l.isMerged || (l.lotNumber || '').startsWith('MW-');
              return (
                <tr
                  key={l.id}
                  className={`border-b border-slate-100 transition-colors ${
                    isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleLot(l.id)}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-800">
                      {l.lotNumber}
                      {isMerged && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">
                          Merged
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{l.product?.name}</td>
                  <td>{l.wastageType?.nameEn}</td>
                  <td>{l.location?.name}</td>
                  <td className="font-semibold text-slate-900">{formatNumber(l.availableKg, 0)} KG</td>
                  <td>{l.reprocessingCycle}</td>
                  <td className="text-xs text-slate-500">
                    {l.productionRun?.productionNumber || l.jobWork?.jobWorkNumber || (l.sourceLotNumbers ? `From: ${l.sourceLotNumbers}` : '—')}
                    <br />
                    {formatDate(l.productionDate)}
                  </td>
                  <td className="space-x-3 text-xs">
                    <button
                      type="button"
                      className="text-blue-600 font-medium hover:underline"
                      disabled={!!starting}
                      onClick={() => startSortex(l)}
                    >
                      {starting === l.id ? '…' : 'Start Sortex'}
                    </button>
                    <button
                      type="button"
                      className="text-indigo-600 font-medium hover:underline"
                      onClick={() => openOutwardModal(l.id)}
                    >
                      Outward
                    </button>
                    <button
                      type="button"
                      className="text-rose-600 font-medium hover:underline"
                      onClick={() => discard(l)}
                    >
                      Discard
                    </button>
                  </td>
                </tr>
              );
            })}
            {!lots?.length && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  No wastage inventory lots
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Select & Merge Modal (§11.1) */}
      {mergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-lg font-semibold text-slate-800">Merge Wastage Lots</h3>
            <p className="mb-4 text-xs text-slate-500">
              Combine multiple wastage lots of the same product into a single unified lot.
            </p>

            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-600">Selected Source Lots</p>
              <ul className="max-h-36 space-y-1 overflow-y-auto text-xs">
                {selectedLots.map((l: any) => (
                  <li key={l.id} className="flex justify-between border-b border-slate-200 py-1">
                    <span className="font-mono font-medium">{l.lotNumber} ({l.wastageType?.nameEn})</span>
                    <span className="font-semibold">{formatNumber(l.availableKg, 0)} KG</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t border-slate-300 pt-2 text-xs font-bold text-slate-900">
                <span>Total Merged Weight:</span>
                <span>{formatNumber(totalSelectedKg, 0)} KG</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="ems-label">Custom Lot Number (optional)</label>
                <input
                  className="ems-input w-full font-mono text-sm"
                  placeholder="Auto-generated (e.g. MW-LOT-2026-0001)"
                  value={targetLotNumber}
                  onChange={(e) => setTargetLotNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="ems-label">Remarks</label>
                <textarea
                  className="ems-input w-full min-h-[60px]"
                  placeholder="Reason or notes for merging..."
                  value={mergeRemarks}
                  onChange={(e) => setMergeRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ems-btn-secondary text-sm"
                onClick={() => setMergeModalOpen(false)}
                disabled={merging}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ems-btn-primary text-sm"
                onClick={handleConfirmMerge}
                disabled={merging}
              >
                {merging ? 'Merging…' : 'Confirm Merge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wastage Outward Modal (§11.3) */}
      {outwardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-lg font-semibold text-slate-800">Record Wastage Outward</h3>
            <p className="mb-4 text-xs text-slate-500">
              Record wastage dispatch by truck for sale or transport.
            </p>

            <div className="space-y-3">
              <div>
                <label className="ems-label">Select Wastage Lot *</label>
                <select
                  className="ems-input w-full font-mono text-sm"
                  value={outwardLotId}
                  onChange={(e) => {
                    setOutwardLotId(e.target.value);
                    const l = (lots || []).find((lot: any) => lot.id === e.target.value);
                    if (l) setOutwardQty(l.availableKg);
                  }}
                >
                  {(lots || []).map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.lotNumber} · {l.product?.name} ({l.wastageType?.nameEn}) — {formatNumber(l.availableKg, 0)} KG available
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="ems-label">Outward Quantity (KG) *</label>
                  <input
                    className="ems-input w-full font-medium"
                    type="number"
                    step="0.001"
                    min="0"
                    max={selectedLotForOutward?.availableKg || 9999999}
                    placeholder="KG"
                    value={outwardQty}
                    onChange={(e) => setOutwardQty(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                  {selectedLotForOutward && (
                    <span className="mt-0.5 text-[11px] text-slate-500">
                      Available: {formatNumber(selectedLotForOutward.availableKg, 0)} KG
                    </span>
                  )}
                </div>
                <div>
                  <label className="ems-label">Outward Date *</label>
                  <input
                    className="ems-input w-full"
                    type="date"
                    value={outwardDate}
                    onChange={(e) => setOutwardDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="ems-label">Truck / Vehicle Number *</label>
                  <input
                    className="ems-input w-full uppercase"
                    placeholder="e.g. GJ-01-XX-1234"
                    value={truckNumber}
                    onChange={(e) => setTruckNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="ems-label">Driver Name</label>
                  <input
                    className="ems-input w-full"
                    placeholder="Optional driver name"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="ems-label">Buyer / Destination Party</label>
                <input
                  className="ems-input w-full"
                  placeholder="Purchaser or recipient plant"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                />
              </div>

              <div>
                <label className="ems-label">Remarks</label>
                <textarea
                  className="ems-input w-full min-h-[60px]"
                  placeholder="Additional delivery remarks..."
                  value={outwardRemarks}
                  onChange={(e) => setOutwardRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ems-btn-secondary text-sm"
                onClick={() => setOutwardModalOpen(false)}
                disabled={savingOutward}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ems-btn-primary text-sm"
                onClick={handleRecordOutward}
                disabled={savingOutward}
              >
                {savingOutward ? 'Saving…' : 'Record Outward'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Yearly Truck Summary Report Modal (§11.4) */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Yearly Wastage Outward Truck Report</h3>
                <p className="text-xs text-slate-500">Summary of outward truck trips and dispatched quantities.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">Year:</label>
                <select
                  className="ems-input py-1 text-xs"
                  value={reportYear}
                  onChange={(e) => reloadYearlyReport(Number(e.target.value))}
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingReport ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading report data…</p>
            ) : truckReport.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No wastage truck dispatches recorded in {reportYear}.</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-slate-600">
                      <th className="py-2 px-3">Truck Number</th>
                      <th className="py-2 px-3 text-center">Number of Trips</th>
                      <th className="py-2 px-3 text-right">Total Dispatched (KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {truckReport.map((row: any) => (
                      <tr key={row.truckNumber} className="border-b border-slate-100">
                        <td className="py-2 px-3 font-semibold text-slate-800">{row.truckNumber}</td>
                        <td className="py-2 px-3 text-center">{row.tripCount}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                          {formatNumber(row.totalQuantityKg, 0)} KG
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 bg-slate-50 font-bold text-slate-900">
                      <td className="py-2 px-3">Total ({truckReport.length} trucks)</td>
                      <td className="py-2 px-3 text-center">
                        {truckReport.reduce((s: number, r: any) => s + (r.tripCount || 0), 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatNumber(truckReport.reduce((s: number, r: any) => s + (r.totalQuantityKg || 0), 0), 0)} KG
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="ems-btn-secondary text-sm"
                onClick={() => setReportModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </ProductionShell>
  );
}
