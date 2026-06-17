'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/sidebar';
import { ContractDetailSkeleton } from '@/components/ui/page-loader';
import { api } from '@/lib/api';
import { useCachedQuery } from '@/lib/use-cached-query';
import { formatDate, formatNumber, statusBadge, statusLabel } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
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

  return (
    <AppShell title={`Contract ${contract.contractNumber}`}>
      <Link href="/contracts" className="mb-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to register
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusBadge(contract.status)}`}>
          {statusLabel(contract.status)}
        </span>
        {contract.productionInformed && (
          <span className="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-800">Informed to Production</span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          {
            title: 'Section A — Basic Contract Information',
            rows: [
              ['Contract Sent Date', formatDate(contract.contractSentDate)],
              ['Received Date', formatDate(contract.receivedDate)],
              ['Salesperson', contract.salesperson?.name],
              ['On Behalf Of', contract.contractOnBehalfOf],
              ['Contract Date', formatDate(contract.contractDate)],
              ['Signed Received', formatDate(contract.signedContractReceivedDate)],
              ['Invoice No.', contract.invoiceNumber ?? 'Pending'],
              ['Status', statusLabel(contract.status)],
            ],
          },
          {
            title: 'Section B — Buyer Information',
            rows: [
              ['Buyer', contract.buyer?.name],
              ['Buyer Code', contract.buyer?.code],
              ['Country', contract.buyer?.country?.name],
              ['EU / Non-EU', contract.euClassification ?? contract.buyer?.euClassification],
              ['Buyer Lot No.', contract.buyerLotNo ?? '—'],
            ],
          },
          {
            title: 'Section C — Product Information',
            rows: [
              ['Product', `${contract.product?.code} — ${contract.product?.name}`],
              ['Variant', contract.productVariant?.name],
              ['Processing', contract.processingType],
              ['Quantity', `${contract.totalMt} ${contract.quantityUnit || 'MT'}`],
              ['Specification', contract.specification],
              ['Quality Req.', contract.qualityRequirement],
            ],
          },
          {
            title: 'Section D — Commercial Information',
            rows: [
              ['FOB Price', formatNumber(contract.fobPrice, 0)],
              ['FOB Currency / Unit', `${contract.fobCurrency} / ${contract.fobPriceUnit}`],
              ['Freight / Unit', `${formatNumber(contract.freight, 0)} (${contract.freightUnit || '—'})`],
              ['Insurance', formatNumber(contract.insurance, 0)],
              ['CIF Price', formatNumber(contract.cifPrice, 0)],
              ['Exchange Rate', formatNumber(contract.exchangeRate, 2)],
              ['FOB INR / Kg', formatNumber(contract.fobInrPerKg, 2)],
              ['Original Price', formatNumber(contract.originalContractPrice, 0)],
              ['Amendment Price', formatNumber(contract.amendmentPrice, 0)],
            ],
          },
          {
            title: 'Shipment & Dispatch',
            rows: [
              ['Total MT', contract.totalMt],
              ['FCL', contract.numberOfContainers],
              ['Order MT / Filled MT', `${contract.totalMt} / —`],
              ['Port', contract.destinationPort?.name],
              ['Shipment Period', contract.shipmentMonth],
              ['Container No.', contract.containerNo ?? 'Pending'],
              ['Packing', contract.packingDescription ?? contract.packagingSize?.label],
            ],
          },
          {
            title: 'Payment',
            rows: [
              ['Payment Type', contract.paymentType?.replace(/_/g, ' ')],
              ['Advance %', contract.advancePercentage ? `${contract.advancePercentage}%` : '—'],
              ['Balance Stage', contract.balancePaymentStage ?? '—'],
            ],
          },
        ].map((section) => (
          <div key={section.title} className="ems-card p-5">
            <h3 className="mb-3 font-semibold text-slate-800">{section.title}</h3>
            <dl className="space-y-2">
              {section.rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 text-sm">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-800 text-right">{value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {contract.remarks && (
        <div className="mt-4 ems-card p-5">
          <h3 className="mb-2 font-semibold">Remarks</h3>
          <p className="text-sm text-slate-600">{contract.remarks}</p>
        </div>
      )}
    </AppShell>
  );
}
