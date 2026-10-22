'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/sidebar';
import { ContractDetailSkeleton } from '@/components/ui/page-loader';
import { AmendmentModal } from '@/components/contracts/amendment-modal';
import { AmendmentHistory } from '@/components/contracts/amendment-history';
import { AuditLogPanel } from '@/components/contracts/audit-log-panel';
import { ContainerStatusUpdater } from '@/components/contracts/container-status-updater';
import { api, ContractContainer } from '@/lib/api';
import { useCachedQuery, invalidateQueryCache } from '@/lib/use-cached-query';
import { showSuccess, showError } from '@/lib/toast';
import { DueDateBadge } from '@/components/contracts/contract-register';
import { BASIC_DATE_LABELS, CONTAINER_FIELD_LABELS } from '@/lib/contract-labels';
import { commercialFieldVisibility } from '@/lib/commercial-calculations';
import { formatDate, formatNumber, statusBadge, statusLabel } from '@/lib/utils';
import { ArrowLeft, Pencil, Scale, XCircle } from 'lucide-react';

function containerPrice(c: ContractContainer) {
  const term = (c.incoterm ?? 'FOB').toUpperCase();
  if (term === 'CIF') return c.currentCifCnfPrice ?? c.cifPrice;
  if (term === 'CNF') return c.currentCifCnfPrice ?? c.cnfPrice;
  return c.fobPrice;
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const successToastShown = useRef(false);
  const [amendTarget, setAmendTarget] = useState<ContractContainer | null>(null);

  useEffect(() => {
    if (successToastShown.current) return;
    if (searchParams.get('created') === '1') {
      successToastShown.current = true;
      showSuccess('Contract created successfully');
      router.replace(`/contracts/${id}`);
    } else if (searchParams.get('draft') === '1') {
      successToastShown.current = true;
      showSuccess('Contract saved as draft successfully');
      router.replace(`/contracts/${id}`);
    }
  }, [id, router, searchParams]);

  const { data: contract, loading } = useCachedQuery(
    id ? `contract:${id}` : 'contract:unknown',
    () => api.contract(id!),
  );

  if (loading && !contract) {
    return (
      <AppShell title="Contract Detail">
        <ContractDetailSkeleton />
      </AppShell>
    );
  }

  if (!contract) {
    return (
      <AppShell title="Contract Detail">
        <p className="text-center text-sm text-slate-500">Contract not found.</p>
      </AppShell>
    );
  }

  const containers = contract.containers?.length
    ? contract.containers
    : [
        {
          id: 'legacy',
          containerIndex: 1,
          productId: contract.product?.id || '',
          product: contract.product,
          productVariant: contract.productVariant,
          processingType: contract.processingType,
          specification: contract.specification,
          quantityMt: contract.totalMt,
          destinationPort: contract.destinationPort,
          incoterm: contract.incoterm,
          fobPrice: contract.fobPrice,
          fobCurrency: contract.fobCurrency,
          exchangeRate: contract.exchangeRate,
          fobInrPerKg: contract.fobInrPerKg,
          totalFreight: contract.freight,
          insurance: contract.insurance,
          cifPrice: contract.cifPrice,
        } as ContractContainer,
      ];

  const currentUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ems_user') || '{}') : {};
  const creatorId = (contract as any).createdById || contract.createdBy?.id;
  const isCreator = currentUser.id === creatorId || currentUser.sub === creatorId;
  const isAdmin = ['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(currentUser.role);
  const canReviseQty = (isCreator || isAdmin) && contract.status !== 'CANCELLED';
  const canCancel = (isCreator || isAdmin) && contract.status !== 'CANCELLED' && contract.status !== 'COMPLETED';

  const [reviseModalOpen, setReviseModalOpen] = useState(false);
  const [reviseMt, setReviseMt] = useState<number>(contract.totalMt);
  const [reviseReason, setReviseReason] = useState('');
  const [revising, setRevising] = useState(false);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const handleReviseQuantity = async () => {
    if (!reviseMt || reviseMt <= 0) {
      showError('Please enter a valid total MT');
      return;
    }
    if (!reviseReason.trim()) {
      showError('Reason for quantity revision is required');
      return;
    }
    setRevising(true);
    try {
      await api.reviseQuantity(contract.id, {
        totalMt: Number(reviseMt),
        reason: reviseReason.trim(),
      });
      showSuccess('Contract quantity updated successfully');
      setReviseModalOpen(false);
      refreshContract();
    } catch (e: any) {
      showError(e?.message || 'Failed to revise quantity');
    } finally {
      setRevising(false);
    }
  };

  const handleCancelContract = async () => {
    if (!cancelReason.trim()) {
      showError('Reason for contract cancellation is required');
      return;
    }
    setCancelling(true);
    try {
      await api.cancelContract(contract.id, {
        reason: cancelReason.trim(),
      });
      showSuccess('Contract cancelled successfully');
      setCancelModalOpen(false);
      refreshContract();
    } catch (e: any) {
      showError(e?.message || 'Failed to cancel contract');
    } finally {
      setCancelling(false);
    }
  };

  const canEdit = (() => {
    const user = currentUser;
    const hasEditRole = ['SUPER_ADMIN', 'OFFICE_ADMIN', 'CONTRACT_TEAM'].includes(user.role);
    if (!hasEditRole) return false;
    const isAdm = user.role === 'SUPER_ADMIN' || user.role === 'OFFICE_ADMIN';
    if (isAdm) return true;
    return ['DRAFT', 'UNDER_PREPARATION', 'AWAITING_SIGNED_CONTRACT'].includes(contract.status);
  })();

  const isOwner = (() => {
    return ['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(currentUser.role);
  })();

  const canAmend = (c: ContractContainer) => {
    const vis = commercialFieldVisibility((c.incoterm ?? 'FOB') as 'FOB' | 'CIF' | 'CNF');
    const roleOk = ['SUPER_ADMIN', 'OFFICE_ADMIN', 'CONTRACT_TEAM', 'SUPER_SALES'].includes(currentUser.role);
    return vis.changeAmendment && roleOk;
  };

  const canUpdateContainerStatus = (() => {
    return ['SUPER_ADMIN', 'OFFICE_ADMIN', 'CONTRACT_TEAM', 'PRODUCTION_TEAM', 'SUPER_SALES'].includes(currentUser.role);
  })();

  const refreshContract = () => {
    invalidateQueryCache(`contract:${id}`);
    window.location.reload();
  };

  return (
    <AppShell title={`Contract ${contract.contractNumber}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/contracts" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to register
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canReviseQty && (
            <button
              type="button"
              onClick={() => {
                setReviseMt(contract.totalMt);
                setReviseReason('');
                setReviseModalOpen(true);
              }}
              className="ems-btn-secondary gap-1 text-sm"
            >
              <Scale className="h-4 w-4 text-blue-600" /> Revise Quantity
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => {
                setCancelReason('');
                setCancelModalOpen(true);
              }}
              className="ems-btn-secondary gap-1 text-sm text-rose-600 hover:border-rose-300 hover:bg-rose-50"
            >
              <XCircle className="h-4 w-4 text-rose-600" /> Cancel Contract
            </button>
          )}
          {canEdit && (
            <Link href={`/contracts/${id}/edit`} className="ems-btn-secondary gap-1 text-sm">
              <Pencil className="h-4 w-4" /> Edit Contract
            </Link>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusBadge(contract.status)}`}>
          {statusLabel(contract.status)}
        </span>
        {contract.productionInformed && (
          <span className="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-800">Informed to Production</span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="ems-card p-5">
          <h3 className="mb-3 font-semibold text-slate-800">Section A — Basic Contract Information</h3>
          <dl className="space-y-2">
            {[
              [BASIC_DATE_LABELS.contractSentDate, formatDate(contract.contractSentDate)],
              [BASIC_DATE_LABELS.receivedDate, formatDate(contract.receivedDate)],
              [BASIC_DATE_LABELS.contractDate, formatDate(contract.contractDate)],
              [BASIC_DATE_LABELS.signedContractReceivedDate, formatDate(contract.signedContractReceivedDate)],
              ['Created By', contract.createdBy?.name],
              ['Created By Role', contract.createdBy?.role === 'SUPER_SALES' ? 'Super Sales' : contract.createdBy?.role],
              [
                'Salesperson Responsible',
                contract.salesAttributions?.map((a) => a.salesperson?.name).filter(Boolean).join(', ') ||
                  contract.salesperson?.name,
              ],
              [
                'Super Sales',
                contract.createdBy?.role === 'SUPER_SALES' ? contract.createdBy?.name : '—',
              ],
              ['Created On', formatDate(contract.createdAt as string | undefined)],
              ['Status', statusLabel(contract.status)],
            ].map(([label, value]) => (
              <Row key={String(label)} label={String(label)} value={value} />
            ))}
          </dl>
        </div>

        <div className="ems-card p-5">
          <h3 className="mb-3 font-semibold text-slate-800">Section B — Buyer Information</h3>
          <dl className="space-y-2">
            {[
              ['Buyer', contract.buyer?.name],
              ['Buyer Code', contract.buyer?.code],
              ['Country', contract.buyer?.country?.name],
              ['EU / Non-EU', contract.euClassification ?? contract.buyer?.euClassification],
            ].map(([label, value]) => (
              <Row key={String(label)} label={String(label)} value={value} />
            ))}
          </dl>
        </div>

        <div className="ems-card p-5 lg:col-span-2">
          <h3 className="mb-3 font-semibold text-slate-800">Section C–D — Container-wise Review</h3>
          <div className="space-y-6">
            {containers.map((c) => {
              const vis = commercialFieldVisibility((c.incoterm ?? 'FOB') as 'FOB' | 'CIF' | 'CNF');
              const period =
                c.shipmentMonth && c.shipmentYear && c.shipmentHalf
                  ? `${c.shipmentMonth}-${String(c.shipmentYear).slice(-2)} (${c.shipmentHalf === 'FIRST_HALF' ? '1–15' : '16–end'})`
                  : c.expectedShipmentDate
                    ? formatDate(c.expectedShipmentDate)
                    : '—';
              return (
                <div key={c.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold text-slate-800">
                      {CONTAINER_FIELD_LABELS.containerSequence} {c.containerIndex}
                    </h4>
                    {canAmend(c) && c.id !== 'legacy' && (
                      <button
                        type="button"
                        className="ems-btn-secondary text-xs"
                        onClick={() => setAmendTarget(c)}
                      >
                        Change CIF / CNF
                      </button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <MiniField label="Product" value={`${c.product?.code ?? ''} — ${c.product?.name ?? ''}`} />
                    <MiniField label="Variant" value={c.productVariant?.name} />
                    <MiniField label="Processing" value={c.processingType} />
                    <MiniField label="Specification" value={c.specification} />
                    <MiniField label={CONTAINER_FIELD_LABELS.allocatedMt} value={formatNumber(c.quantityMt, 3)} />
                    <MiniField label="Destination Port" value={c.destinationPort?.name} />
                    <div>
                      <p className="text-xs text-slate-500">{CONTAINER_FIELD_LABELS.expectedShipmentDate}</p>
                      <div className="flex flex-col gap-1 mt-0.5">
                        <span className="text-sm font-medium text-slate-800">{formatDate(c.expectedShipmentDate)}</span>
                        <DueDateBadge dateStr={c.expectedShipmentDate} />
                      </div>
                    </div>
                    <MiniField label={CONTAINER_FIELD_LABELS.shipmentPeriod} value={period} />
                    <MiniField label={CONTAINER_FIELD_LABELS.shippingContainerNo} value={c.containerNo ?? 'Pending'} />
                    <MiniField label="Factory Seal" value={c.factorySealNo ?? '—'} />
                    <MiniField label="Shipping Line Seal" value={c.shippingLineSealNo ?? '—'} />
                    <MiniField label="Container Status" value={c.containerStatus?.replace(/_/g, ' ') ?? '—'} />
                    <MiniField
                      label="Production Fulfilled"
                      value={`${formatNumber(
                        ((contract as any).productionAllocations || [])
                          .filter((a: any) => a.containerId === c.id)
                          .reduce((s: number, a: any) => s + Number(a.quantityKg || 0), 0) / 1000,
                        3,
                      )} MT`}
                    />
                    <MiniField
                      label="Sampling Status"
                      value={
                        ((contract as any).sampleRecords || [])
                          .filter((s: any) => s.containerId === c.id)
                          .map((s: any) => `${s.product?.code || ''}: ${String(s.status || '').replace(/_/g, ' ')}`)
                          .join(' · ') || '—'
                      }
                    />
                    <MiniField label="Invoice No." value={c.invoiceNumber ?? '—'} />
                    <MiniField label="Invoice Amount" value={formatNumber(c.invoiceAmount, 0)} />
                    <MiniField label="Payment Status" value={c.paymentStatus?.replace(/_/g, ' ') ?? '—'} />
                    <MiniField label="Received Amount" value={formatNumber(c.receivedAmount, 0)} />
                    <MiniField label="Remaining Amount" value={formatNumber(c.remainingAmount, 0)} />
                    <MiniField label="Incoterm" value={c.incoterm} />
                    <MiniField label="FOB Price" value={formatNumber(c.fobPrice, 2)} />
                    <MiniField label="FOB Currency" value={c.fobCurrency} />
                    <MiniField label="Exchange Rate" value={formatNumber(c.exchangeRate, 4)} />
                    <MiniField label="FOB INR / Kg" value={formatNumber(c.fobInrPerKg, 2)} />
                    {vis.totalFreight && (
                      <MiniField label={CONTAINER_FIELD_LABELS.totalFreight} value={formatNumber(c.totalFreight, 2)} />
                    )}
                    {vis.freightPerMt && (
                      <MiniField label={CONTAINER_FIELD_LABELS.freightPerMt} value={formatNumber(c.freightPerMt, 2)} />
                    )}
                    {vis.insurance && <MiniField label="Insurance" value={formatNumber(c.insurance, 2)} />}
                    {vis.cifPrice && <MiniField label="CIF Price" value={formatNumber(c.cifPrice, 2)} />}
                    {vis.cnfPrice && <MiniField label="CNF Price" value={formatNumber(c.cnfPrice, 2)} />}
                    {vis.changeAmendment && (
                      <MiniField label="Current Price" value={formatNumber(containerPrice(c), 2)} />
                    )}
                    {vis.changeAmendment && c.originalCifCnfPrice != null && (
                      <MiniField label="Original Calculated Price" value={formatNumber(c.originalCifCnfPrice, 2)} />
                    )}
                  </div>
                  {!!(contract as any).productionAllocations?.filter((a: any) => a.containerId === c.id).length && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Production allocations (read-only)
                      </p>
                      <ul className="space-y-1 text-sm text-slate-700">
                        {(contract as any).productionAllocations
                          .filter((a: any) => a.containerId === c.id)
                          .map((a: any) => (
                            <li key={a.id}>
                              {a.product?.code} — {formatNumber(a.quantityKg / 1000, 3)} MT
                              {a.productionRun?.productionNumber ? ` · ${a.productionRun.productionNumber}` : ''}
                              {a.processedLot?.lotNumber ? ` · lot ${a.processedLot.lotNumber}` : ''}
                              {' · '}
                              {formatDate(a.allocationDate)}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {!!c.products?.length && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Products</p>
                      <ul className="space-y-1 text-sm text-slate-700">
                        {c.products.map((p) => (
                          <li key={p.id}>
                            {p.product?.code} — {p.product?.name}: {formatNumber(p.quantityMt, 3)} MT
                            {p.specification ? ` · ${p.specification}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!!c.amendments?.length && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Price Change History</p>
                      <ul className="space-y-2 text-sm text-slate-700">
                        {c.amendments.map((a) => (
                          <li key={a.id} className="rounded-lg bg-slate-50 p-2">
                            {a.incoterm}: {a.previousValue} → {a.amendedValue} {a.currency}
                            {a.amendedBy?.name ? ` by ${a.amendedBy.name}` : ''} · {formatDate(a.amendmentDate)}
                            <br />
                            <span className="text-slate-500">Reason: {a.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.id !== 'legacy' && (
                    <ContainerStatusUpdater
                      contractId={contract.id}
                      container={c}
                      canUpdate={canUpdateContainerStatus}
                      onUpdated={refreshContract}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="ems-card p-5">
          <h3 className="mb-3 font-semibold text-slate-800">Payment</h3>
          <dl className="space-y-2">
            {[
              ['Payment Type', contract.paymentType?.replace(/_/g, ' ')],
              ['Advance %', contract.advancePercentage ? `${contract.advancePercentage}%` : '—'],
              ['Balance Stage', contract.balancePaymentStage ?? '—'],
              ['Other Payment Method', contract.otherPaymentMethod ?? '—'],
            ].map(([label, value]) => (
              <Row key={String(label)} label={String(label)} value={value} />
            ))}
          </dl>
        </div>

        <div className="ems-card p-5">
          <h3 className="mb-3 font-semibold text-slate-800">Summary</h3>
          <dl className="space-y-2">
            {[
              ['Total MT', contract.totalMt],
              ['Containers', contract.numberOfContainers],
              ['Packing', contract.packingDescription ?? contract.packagingSize?.label],
            ].map(([label, value]) => (
              <Row key={String(label)} label={String(label)} value={value} />
            ))}
          </dl>
        </div>
      </div>

      {contract.remarks && (
        <div className="mt-4 ems-card p-5">
          <h3 className="mb-2 font-semibold">Remarks</h3>
          <p className="text-sm text-slate-600">{contract.remarks}</p>
        </div>
      )}

      <AmendmentHistory containers={containers} />

      {isOwner && (
        <div className="mt-4 ems-card p-5">
          <h3 className="mb-3 font-semibold text-slate-800">Audit Log</h3>
          <AuditLogPanel contractId={contract.id} />
        </div>
      )}

      {amendTarget && amendTarget.id !== 'legacy' && (
        <AmendmentModal
          open
          contractId={contract.id}
          containerId={amendTarget.id}
          incoterm={amendTarget.incoterm ?? 'CIF'}
          currentPrice={containerPrice(amendTarget) ?? 0}
          onClose={() => setAmendTarget(null)}
          onAmended={() => {
            invalidateQueryCache(`contract:${id}`);
            window.location.reload();
          }}
        />
      )}

      {reviseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-slate-800">Revise Contract Quantity</h3>
            <p className="mb-4 text-xs text-slate-500">
              Update total contracted metric tonnes. Cannot be reduced below fulfilled / allocated quantity.
            </p>
            <div className="space-y-3">
              <div>
                <label className="ems-label">Current Total (MT)</label>
                <input className="ems-input w-full bg-slate-100" value={contract.totalMt} disabled />
              </div>
              <div>
                <label className="ems-label">New Total (MT) *</label>
                <input
                  className="ems-input w-full"
                  type="number"
                  step="0.001"
                  min="0"
                  value={reviseMt || ''}
                  onChange={(e) => setReviseMt(Number(e.target.value))}
                  placeholder="e.g. 50"
                />
              </div>
              <div>
                <label className="ems-label">Reason for Revision *</label>
                <textarea
                  className="ems-input w-full min-h-[80px]"
                  placeholder="Explain why contract quantity is being revised..."
                  value={reviseReason}
                  onChange={(e) => setReviseReason(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="ems-btn-secondary text-sm"
                onClick={() => setReviseModalOpen(false)}
                disabled={revising}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ems-btn-primary text-sm"
                onClick={handleReviseQuantity}
                disabled={revising}
              >
                {revising ? 'Saving…' : 'Confirm Revision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl border border-rose-200">
            <h3 className="mb-2 text-lg font-semibold text-rose-800">Cancel Contract</h3>
            <p className="mb-4 text-xs text-slate-600">
              Are you sure you want to cancel Contract <span className="font-semibold">{contract.contractNumber}</span>? 
              This action cannot be undone. Contracts with dispatched containers or active allocations cannot be cancelled.
            </p>
            <div className="space-y-3">
              <div>
                <label className="ems-label">Reason for Cancellation *</label>
                <textarea
                  className="ems-input w-full min-h-[80px]"
                  placeholder="State the reason for contract cancellation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="ems-btn-secondary text-sm"
                onClick={() => setCancelModalOpen(false)}
                disabled={cancelling}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                onClick={handleCancelContract}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value ?? '—'}</dd>
    </div>
  );
}

function MiniField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value ?? '—'}</p>
    </div>
  );
}
