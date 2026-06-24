import type { Contract, ContainerProduct, ContractForm } from '@/lib/api';
import { enrichContainerCommercial } from '@/lib/commercial-calculations';
import { formatShipmentMonthDb } from '@/lib/shipment-period';

export function contractToContainerProducts(contract: Contract): ContainerProduct[] {
  if (contract.containers?.length) {
    return contract.containers.map((c) => ({
      productId: c.productId,
      productVariantId: c.productVariantId,
      processingType: c.processingType,
      specification: c.specification,
      productRemarks: c.productRemarks,
      destinationPortId: c.destinationPortId,
      shipmentMonthYear: c.expectedShipmentDate?.slice(0, 7),
      shipmentHalf: c.shipmentHalf as ContainerProduct['shipmentHalf'],
      expectedShipmentDate: c.expectedShipmentDate?.slice(0, 10),
      containerNo: c.containerNo,
      quantityMt: c.quantityMt,
      packagingTypeId: c.packagingTypeId,
      packagingSizeId: c.packagingSizeId,
      packingDescription: c.packingDescription ?? c.packagingSize?.label,
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
    }));
  }
  return [
    {
      productId: contract.product?.id || '',
      productVariantId: contract.productVariant?.name ? undefined : undefined,
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
  return {
    officeId: contract.office?.id || '',
    contractNumber: contract.contractNumber,
    contractSentDate: contract.contractSentDate?.slice(0, 10),
    receivedDate: contract.receivedDate?.slice(0, 10),
    contractDate: contract.contractDate?.slice(0, 10),
    signedContractReceivedDate: contract.signedContractReceivedDate?.slice(0, 10),
    salespersonId: contract.salesperson?.id,
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
    const calc = enrichContainerCommercial({
      incoterm,
      fobPrice: c.fobPrice,
      exchangeRate: c.exchangeRate,
      quantityMt,
      totalFreight: c.totalFreight,
      insurance: c.insurance,
    });
    return {
      containerIndex: i + 1,
      productId: c.productId,
      productVariantId: c.productVariantId || undefined,
      processingType: c.processingType || undefined,
      specification: c.specification || undefined,
      productRemarks: c.productRemarks || undefined,
      quantityMt,
      destinationPortId: c.destinationPortId || undefined,
      expectedShipmentDate: c.expectedShipmentDate || undefined,
      shipmentMonth: c.shipmentMonthYear ? formatShipmentMonthDb(c.shipmentMonthYear) : undefined,
      shipmentYear: c.shipmentMonthYear ? Number(c.shipmentMonthYear.split('-')[0]) : undefined,
      shipmentHalf: c.shipmentHalf || undefined,
      containerNo: c.containerNo || undefined,
      packagingTypeId: c.packagingTypeId || undefined,
      packagingSizeId: c.packagingSizeId || undefined,
      packingDescription: c.packingDescription || undefined,
      packingSizeValue: c.packingSizeValue ?? undefined,
      packingSizeUnit: c.packingSizeUnit || undefined,
      incoterm,
      fobPrice: c.fobPrice,
      fobCurrency: c.fobCurrency,
      exchangeRate: c.exchangeRate,
      exchangeRateAt: c.exchangeRateAt,
      exchangeRateSource: c.exchangeRateSource,
      exchangeRateManual: c.exchangeRateManual,
      totalFreight: c.totalFreight,
      freightPerMt: calc.freightPerMt,
      fobInrPerKg: calc.fobInrPerKg,
      insurance: c.insurance,
      cifPrice: calc.cifPrice,
      cnfPrice: calc.cnfPrice,
      commercialRemarks: c.commercialRemarks,
    };
  });
}
