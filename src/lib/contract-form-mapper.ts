import type { Contract, ContainerProduct, ContainerProductLine, ContractForm } from '@/lib/api';
import { formatShipmentMonthDb } from '@/lib/shipment-period';

export function contractToContainerProducts(contract: Contract): ContainerProduct[] {
  if (contract.containers?.length) {
    return contract.containers.map((c) => {
      const products: ContainerProductLine[] =
        c.products?.length
          ? c.products.map((p) => ({
              productIndex: p.productIndex,
              productId: p.productId,
              productVariantId: p.productVariant?.id,
              processingType: p.processingType,
              specification: p.specification,
              quantityMt: p.quantityMt,
              packagingTypeId: p.packagingTypeId,
              packagingSizeId: p.packagingSizeId,
              packingDescription: p.packingDescription,
              productRemarks: p.productRemarks,
            }))
          : [
              {
                productIndex: 1,
                productId: c.productId,
                productVariantId: c.productVariantId,
                processingType: c.processingType,
                specification: c.specification,
                quantityMt: c.quantityMt ?? 0,
                packagingTypeId: c.packagingTypeId,
                packagingSizeId: c.packagingSizeId,
                packingDescription: c.packingDescription,
                productRemarks: c.productRemarks,
              },
            ];
      const primary = products[0];
      return {
        productId: primary?.productId || c.productId,
        productVariantId: primary?.productVariantId || c.productVariantId,
        processingType: primary?.processingType || c.processingType,
        specification: primary?.specification || c.specification,
        productRemarks: primary?.productRemarks || c.productRemarks,
        products,
        destinationPortId: c.destinationPortId,
        shipmentMonthYear: c.expectedShipmentDate?.slice(0, 7),
        shipmentHalf: c.shipmentHalf as ContainerProduct['shipmentHalf'],
        expectedShipmentDate: c.expectedShipmentDate?.slice(0, 10),
        containerNo: c.containerNo,
        factorySealNo: c.factorySealNo,
        shippingLineSealNo: c.shippingLineSealNo,
        quantityMt: c.quantityMt,
        packagingTypeId: primary?.packagingTypeId || c.packagingTypeId,
        packagingSizeId: primary?.packagingSizeId || c.packagingSizeId,
        packingDescription: primary?.packingDescription ?? c.packingDescription ?? c.packagingSize?.label,
        packingSizeValue: c.packingSizeValue,
        packingSizeUnit: c.packingSizeUnit,
        incoterm: c.incoterm as ContainerProduct['incoterm'],
        fobPrice: c.fobPrice,
        fobCurrency: c.fobCurrency,
        exchangeRate: c.exchangeRate,
        exchangeRateAt: c.exchangeRateAt,
        exchangeRateSource: c.exchangeRateSource,
        totalFreight: c.totalFreight,
        freightPerMt: c.freightPerMt,
        fobInrPerKg: c.fobInrPerKg,
        insurance: c.insurance,
        cifPrice: c.cifPrice,
        cnfPrice: c.cnfPrice,
        commercialRemarks: c.commercialRemarks,
        invoiceNumber: c.invoiceNumber,
        invoiceAmount: c.invoiceAmount,
        invoiceDate: c.invoiceDate?.slice(0, 10),
        paymentReceived: c.paymentReceived,
        paymentStatus: c.paymentStatus,
        receivedAmount: c.receivedAmount,
        remainingAmount: c.remainingAmount,
        paymentRemarks: c.paymentRemarks,
        containerStatus: c.containerStatus,
      };
    });
  }
  return [
    {
      productId: contract.product?.id || '',
      products: [
        {
          productIndex: 1,
          productId: contract.product?.id || '',
          quantityMt: contract.totalMt || 0,
          processingType: contract.processingType,
          specification: contract.specification,
        },
      ],
      processingType: contract.processingType,
      specification: contract.specification,
      productRemarks: contract.productRemarks,
      destinationPortId: contract.destinationPort?.id,
      incoterm: contract.incoterm as ContainerProduct['incoterm'],
      fobPrice: contract.fobPrice,
      fobCurrency: contract.fobCurrency,
      exchangeRate: contract.exchangeRate,
      totalFreight: contract.freight,
      insurance: contract.insurance,
    },
  ];
}

export function contractToForm(contract: Contract): ContractForm {
  const salespersonIds =
    contract.salesAttributions?.map((a) => a.salespersonId || a.salesperson?.id).filter(Boolean) as string[] ||
    (contract.salesperson?.id ? [contract.salesperson.id] : []);
  return {
    officeId: contract.office?.id || '',
    contractNumber: contract.contractNumber,
    contractSentDate: contract.contractSentDate?.slice(0, 10),
    receivedDate: contract.receivedDate?.slice(0, 10),
    contractDate: contract.contractDate?.slice(0, 10),
    signedContractReceivedDate: contract.signedContractReceivedDate?.slice(0, 10),
    salespersonId: salespersonIds[0] || contract.salesperson?.id,
    salespersonIds,
    invoiceNumber: contract.invoiceNumber,
    remarks: contract.remarks,
    internalRemarks: contract.internalRemarks,
    status: contract.status,
    buyerId: contract.buyer?.id || '',
    buyerCode: contract.buyer?.code,
    buyerCountryId: contract.buyer?.country?.id,
    euClassification: contract.euClassification || contract.buyer?.euClassification,
    buyerAddress: contract.buyer?.address,
    buyerContactPerson: contract.buyer?.contactPerson,
    buyerEmail: contract.buyer?.email,
    buyerPhone: contract.buyer?.phone,
    productId: contract.product?.id || '',
    totalMt: contract.totalMt,
    quantityUnit: contract.quantityUnit || 'MT',
    numberOfContainers: contract.numberOfContainers,
    incoterm: contract.incoterm,
    fobPrice: contract.fobPrice,
    fobCurrency: contract.fobCurrency,
    fobPriceUnit: contract.fobPriceUnit,
    freight: contract.freight,
    freightUnit: contract.freightUnit,
    insurance: contract.insurance,
    cifPrice: contract.cifPrice,
    exchangeRate: contract.exchangeRate,
    originalContractPrice: contract.originalContractPrice,
    amendmentPrice: contract.amendmentPrice,
    amendmentCurrency: contract.amendmentCurrency,
    amendmentDate: contract.amendmentDate?.slice(0, 10),
    amendmentReason: contract.amendmentReason,
    commercialRemarks: contract.commercialRemarks,
    paymentType: contract.paymentType,
    advancePercentage: contract.advancePercentage,
    balancePaymentStage: contract.balancePaymentStage,
    otherPaymentMethod: contract.otherPaymentMethod,
    packingDescription: contract.packingDescription,
  };
}

export function buildContainerProductsPayload(
  containerProducts: ContainerProduct[],
  totalMt: number,
) {
  return containerProducts.map((c, i) => {
    const quantityMt = c.quantityMt ?? totalMt / containerProducts.length;
    const incoterm = c.incoterm ?? 'FOB';
    const lines: ContainerProductLine[] =
      c.products?.length
        ? c.products
        : c.productId
          ? [
              {
                productIndex: 1,
                productId: c.productId,
                productVariantId: c.productVariantId,
                processingType: c.processingType,
                specification: c.specification,
                quantityMt,
                packagingTypeId: c.packagingTypeId,
                packagingSizeId: c.packagingSizeId,
                packingDescription: c.packingDescription,
                packingSizeValue: c.packingSizeValue,
                packingSizeUnit: c.packingSizeUnit,
                productRemarks: c.productRemarks,
              },
            ]
          : [];
    const primary = lines[0];
    return {
      containerIndex: i + 1,
      productId: primary?.productId || c.productId,
      productVariantId: primary?.productVariantId || c.productVariantId || undefined,
      processingType: primary?.processingType || c.processingType || undefined,
      specification: primary?.specification || c.specification || undefined,
      productRemarks: primary?.productRemarks || c.productRemarks || undefined,
      products: lines.map((p, idx) => ({
        productIndex: p.productIndex ?? idx + 1,
        productId: p.productId,
        productVariantId: p.productVariantId || undefined,
        processingType: p.processingType || undefined,
        specification: p.specification || undefined,
        quantityMt: p.quantityMt,
        packagingTypeId: p.packagingTypeId || undefined,
        packagingSizeId: p.packagingSizeId || undefined,
        packingDescription: p.packingDescription || undefined,
        packingSizeValue: p.packingSizeValue,
        packingSizeUnit: p.packingSizeUnit || undefined,
        productRemarks: p.productRemarks || undefined,
      })),
      quantityMt,
      destinationPortId: c.destinationPortId || undefined,
      expectedShipmentDate: c.expectedShipmentDate || undefined,
      shipmentMonth: c.shipmentMonthYear ? formatShipmentMonthDb(c.shipmentMonthYear) : undefined,
      shipmentYear: c.shipmentMonthYear ? Number(c.shipmentMonthYear.split('-')[0]) : undefined,
      shipmentHalf: c.shipmentHalf || undefined,
      containerNo: c.containerNo || undefined,
      factorySealNo: c.factorySealNo || undefined,
      shippingLineSealNo: c.shippingLineSealNo || undefined,
      packagingTypeId: primary?.packagingTypeId || c.packagingTypeId || undefined,
      packagingSizeId: primary?.packagingSizeId || c.packagingSizeId || undefined,
      packingDescription: primary?.packingDescription || c.packingDescription || undefined,
      packingSizeValue: primary?.packingSizeValue ?? c.packingSizeValue,
      packingSizeUnit: primary?.packingSizeUnit || c.packingSizeUnit || undefined,
      incoterm,
      fobPrice: c.fobPrice,
      fobCurrency: c.fobCurrency,
      exchangeRate: c.exchangeRate,
      exchangeRateAt: c.exchangeRateAt,
      exchangeRateSource: c.exchangeRateSource,
      exchangeRateManual: c.exchangeRateManual,
      totalFreight: c.totalFreight,
      // Computed fields (fobInrPerKg, freightPerMt, cif/cnf) are derived on the server — do not send.
      insurance: c.insurance,
      commercialRemarks: c.commercialRemarks,
      invoiceNumber: c.invoiceNumber || undefined,
      invoiceAmount: c.invoiceAmount,
      invoiceDate: c.invoiceDate || undefined,
      paymentReceived: c.paymentReceived,
      paymentStatus: c.paymentStatus || undefined,
      receivedAmount: c.receivedAmount,
      paymentRemarks: c.paymentRemarks || undefined,
      containerStatus: c.containerStatus || undefined,
    };
  });
}

export function productSummaryFromContainers(containers?: Contract['containers']): string {
  if (!containers?.length) return '—';
  const map = new Map<string, number>();
  for (const c of containers) {
    if (c.products?.length) {
      for (const p of c.products) {
        const name = p.product?.name || p.product?.code || 'Product';
        map.set(name, (map.get(name) || 0) + (p.quantityMt || 0));
      }
    } else if (c.product) {
      const name = c.product.name || c.product.code;
      map.set(name, (map.get(name) || 0) + (c.quantityMt || 0));
    }
  }
  if (!map.size) return '—';
  return [...map.entries()].map(([name, mt]) => `${name}: ${mt} MT`).join(', ');
}

export function paymentRollup(containers?: Contract['containers']): {
  status: string;
  remaining: number;
  invoiceTotal: number;
  receivedTotal: number;
} {
  const list = containers || [];
  const invoiceTotal = list.reduce((s, c) => s + (c.invoiceAmount || 0), 0);
  const receivedTotal = list.reduce((s, c) => s + (c.receivedAmount || 0), 0);
  const remaining = Math.round((invoiceTotal - receivedTotal) * 1000) / 1000;
  const statuses = list.map((c) => c.paymentStatus || 'NOT_RAISED');
  let status = 'NOT_RAISED';
  if (statuses.some((s) => s === 'PARTIAL' || (s === 'PENDING' && receivedTotal > 0))) status = 'PARTIAL';
  else if (statuses.every((s) => s === 'RECEIVED') && list.length) status = 'RECEIVED';
  else if (statuses.some((s) => s === 'PENDING' || s === 'INVOICE_RAISED' || s === 'PARTIAL')) status = 'PENDING';
  else if (statuses.some((s) => s === 'OVERDUE')) status = 'OVERDUE';
  return { status, remaining, invoiceTotal, receivedTotal };
}
