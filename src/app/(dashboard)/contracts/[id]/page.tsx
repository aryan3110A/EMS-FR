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
import { showSuccess } from '@/lib/toast';
import { BASIC_DATE_LABELS, CONTAINER_FIELD_LABELS } from '@/lib/contract-labels';
import { commercialFieldVisibility } from '@/lib/commercial-calculations';
import { formatDate, formatNumber, statusBadge, statusLabel } from '@/lib/utils';
import { ArrowLeft, Pencil } from 'lucide-react';

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

  const canEdit = (() => {
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ems_user') || '{}') : {};
    const hasEditRole = ['SUPER_ADMIN', 'OFFICE_ADMIN', 'CONTRACT_TEAM'].includes(user.role);
    if (!hasEditRole) return false;
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'OFFICE_ADMIN';
    if (isAdmin) return true;
    return ['DRAFT', 'UNDER_PREPARATION', 'AWAITING_SIGNED_CONTRACT'].includes(contract.status);
  })();

  const isOwner = (() => {
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ems_user') || '{}') : {};
    return ['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(user.role);
  })();

  const canAmend = (c: ContractContainer) => {
    const vis = commercialFieldVisibility((c.incoterm ?? 'FOB') as 'FOB' | 'CIF' | 'CNF');
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ems_user') || '{}') : {};
    const roleOk = ['SUPER_ADMIN', 'OFFICE_ADMIN', 'CONTRACT_TEAM', 'SUPER_SALES'].includes(user.role);
    return vis.changeAmendment && roleOk;
  };

  const canUpdateContainerStatus = (() => {
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ems_user') || '{}') : {};
    return ['SUPER_ADMIN', 'OFFICE_ADMIN', 'CONTRACT_TEAM', 'PRODUCTION_TEAM', 'SUPER_SALES'].includes(user.role);
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
        {canEdit && (
          <Link href={`/contracts/${id}/edit`} className="ems-btn-secondary gap-1 text-sm">
            <Pencil className="h-4 w-4" /> Edit Contract
          </Link>
        )}
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
                    <MiniField label={CONTAINER_FIELD_LABELS.expectedShipmentDate} value={formatDate(c.expectedShipmentDate)} />
                    <MiniField label={CONTAINER_FIELD_LABELS.shipmentPeriod} value={period} />
                    <MiniField label={CONTAINER_FIELD_LABELS.shippingContainerNo} value={c.containerNo ?? 'Pending'} />
                    <MiniField label="Factory Seal" value={c.factorySealNo ?? '—'} />
                    <MiniField label="Shipping Line Seal" value={c.shippingLineSealNo ?? '—'} />
                    <MiniField label="Container Status" value={c.containerStatus?.replace(/_/g, ' ') ?? '—'} />
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
