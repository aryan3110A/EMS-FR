'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Contract, ContractContainer } from '@/lib/api';
import { formatDate, formatNumber, statusBadge, statusLabel } from '@/lib/utils';
import { paymentRollup, productSummaryFromContainers } from '@/lib/contract-form-mapper';

type BuyerGroup = {
  key: string;
  buyerName: string;
  buyerCode?: string;
  contracts: Contract[];
};

function groupByBuyer(contracts: Contract[]): BuyerGroup[] {
  const map = new Map<string, BuyerGroup>();

  for (const contract of contracts) {
    const key = contract.buyer?.id ?? contract.buyer?.name ?? contract.id;
    const existing = map.get(key);
    if (existing) {
      existing.contracts.push(contract);
    } else {
      map.set(key, {
        key,
        buyerName: contract.buyer?.name ?? 'Unknown buyer',
        buyerCode: contract.buyer?.code,
        contracts: [contract],
      });
    }
  }

  return Array.from(map.values())
    .map((g) => ({
      ...g,
      contracts: g.contracts.sort((a, b) => {
        const da = a.contractDate ? new Date(a.contractDate).getTime() : 0;
        const db = b.contractDate ? new Date(b.contractDate).getTime() : 0;
        return db - da;
      }),
    }))
    .sort((a, b) =>
      a.buyerName.localeCompare(b.buyerName, undefined, { sensitivity: 'base' }),
    );
}

/** Use API container rows, or build placeholders from numberOfContainers for older contracts. */
function resolveContainers(contract: Contract): ContractContainer[] {
  if (contract.containers?.length) {
    return [...contract.containers].sort((a, b) => a.containerIndex - b.containerIndex);
  }

  const count = contract.numberOfContainers ?? 0;
  if (count <= 0) return [];

  const mtEach = contract.totalMt / count;
  return Array.from({ length: count }, (_, i) => ({
    id: `${contract.id}-c${i + 1}`,
    containerIndex: i + 1,
    productId: '',
    quantityMt: mtEach,
    product: contract.product,
    productVariant: contract.productVariant,
    processingType: contract.processingType,
    specification: contract.specification,
    productRemarks: contract.productRemarks,
    containerNo: i === 0 ? contract.containerNo : undefined,
    destinationPort: contract.destinationPort,
    shipmentMonth: contract.shipmentMonth,
    shipmentHalf: contract.shipmentHalf,
  }));
}

function DetailItem({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | number | null;
  children?: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      {children ?? (
        <p className="mt-0.5 text-sm font-semibold text-slate-800">{value ?? '—'}</p>
      )}
    </div>
  );
}

function ContainerPanel({ container }: { container: ContractContainer }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-slate-800">
        Container {container.containerIndex}
        {container.quantityMt != null ? ` · ${container.quantityMt} MT` : ''}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem
          label="Product"
          value={
            container.product
              ? `${container.product.code} — ${container.product.name}`
              : undefined
          }
        />
        <DetailItem label="Variant" value={container.productVariant?.name} />
        <DetailItem label="Processing" value={container.processingType} />
        <DetailItem label="Quantity (MT)" value={container.quantityMt} />
        <DetailItem label="Container No." value={container.containerNo ?? 'Pending'} />
        <DetailItem label="Destination Port" value={container.destinationPort?.name} />
        <DetailItem label="Expected Shipment" value={formatDate(container.expectedShipmentDate)} />
        <DetailItem label="Shipment Month" value={container.shipmentMonth} />
        <DetailItem
          label="Shipment Half"
          value={container.shipmentHalf?.replace(/_/g, ' ')}
        />
        <DetailItem label="Specification" value={container.specification} />
        <DetailItem label="Invoice No." value={container.invoiceNumber ?? '—'} />
        <DetailItem label="Invoice Amount" value={container.invoiceAmount != null ? formatNumber(container.invoiceAmount, 0) : '—'} />
        <DetailItem label="Payment Status" value={container.paymentStatus?.replace(/_/g, ' ') ?? '—'} />
        <DetailItem label="Remaining" value={container.remainingAmount != null ? formatNumber(container.remainingAmount, 0) : '—'} />
        <DetailItem label="Factory Seal" value={container.factorySealNo ?? '—'} />
        <DetailItem label="Shipping Line Seal" value={container.shippingLineSealNo ?? '—'} />
        <DetailItem label="Container Status" value={container.containerStatus?.replace(/_/g, ' ') ?? '—'} />
      </div>
      {!!container.products?.length && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-500">Products in container</p>
          <ul className="space-y-1 text-sm text-slate-700">
            {container.products.map((p) => (
              <li key={p.id}>
                {p.product?.name || p.productId}: {p.quantityMt} MT
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ContractCard({ contract }: { contract: Contract }) {
  const [openContainerIndex, setOpenContainerIndex] = useState<number | null>(null);
  const containers = resolveContainers(contract);
  const showContainers = (contract.numberOfContainers ?? 0) > 0;
  const salesNames =
    contract.salesAttributions?.map((a) => a.salesperson?.name).filter(Boolean).join(', ') ||
    contract.salesperson?.name;
  const pay = paymentRollup(contract.containers);
  const productSummary = productSummaryFromContainers(contract.containers);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem label="Contract No.">
          <Link
            href={`/contracts/${contract.id}`}
            className="mt-0.5 inline-block text-sm font-semibold text-blue-600 hover:underline"
          >
            {contract.contractNumber}
          </Link>
        </DetailItem>
        <DetailItem label="Contract Date" value={formatDate(contract.contractDate)} />
        <DetailItem label="Created By" value={contract.createdBy?.name} />
        <DetailItem
          label="Super Sales"
          value={contract.createdBy?.role === 'SUPER_SALES' ? contract.createdBy?.name : '—'}
        />
        <DetailItem
          label="Created By Role"
          value={contract.createdBy?.role === 'SUPER_SALES' ? 'Super Sales' : contract.createdBy?.role}
        />
        <DetailItem label="Salesperson Responsible" value={salesNames} />
        <DetailItem label="Product Summary" value={productSummary} />
        <DetailItem label="Total MT" value={contract.totalMt} />
        <DetailItem label="Containers" value={contract.numberOfContainers} />
        <DetailItem label="Payment Status" value={pay.status.replace(/_/g, ' ')} />
        <DetailItem label="Remaining Payment" value={formatNumber(pay.remaining, 0)} />
        <DetailItem label="Port" value={contract.destinationPort?.name} />
        <DetailItem label="Shipment" value={contract.shipmentMonth} />
        <div>
          <p className="text-xs font-medium text-slate-500">Status</p>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(contract.status)}`}
          >
            {statusLabel(contract.status)}
          </span>
        </div>
      </div>

      {showContainers && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Containers
          </p>
          <div className="flex flex-wrap gap-2">
            {containers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setOpenContainerIndex((prev) =>
                    prev === c.containerIndex ? null : c.containerIndex,
                  )
                }
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  openContainerIndex === c.containerIndex
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                Container {c.containerIndex}
                {c.quantityMt != null ? ` · ${Number(c.quantityMt.toFixed(3))} MT` : ''}
              </button>
            ))}
          </div>

          {openContainerIndex != null &&
            containers
              .filter((c) => c.containerIndex === openContainerIndex)
              .map((c) => (
                <div key={c.id} className="mt-3">
                  <ContainerPanel container={c} />
                </div>
              ))}
        </div>
      )}
    </div>
  );
}

function BuyerCard({ group }: { group: BuyerGroup }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900">{group.buyerName}</p>
          <p className="mt-0.5 text-sm text-slate-500">{group.buyerCode ?? '—'}</p>
          <p className="mt-1 text-sm text-slate-600">
            Total Contracts:{' '}
            <span className="font-semibold text-blue-700">{group.contracts.length}</span>
          </p>
        </div>
        <span className="shrink-0 text-slate-400">
          {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-4 py-4">
          {group.contracts.map((contract) => (
            <ContractCard key={contract.id} contract={contract} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ContractRegisterTable({ contracts }: { contracts: Contract[] }) {
  const groups = useMemo(() => groupByBuyer(contracts), [contracts]);

  if (groups.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">No contracts found</div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {groups.map((group) => (
        <BuyerCard key={group.key} group={group} />
      ))}
    </div>
  );
}
