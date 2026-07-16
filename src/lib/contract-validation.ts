import type { ContainerProduct, ContractForm } from '@/lib/api';
import { validateContainerQuantities } from '@/lib/commercial-calculations';

export type FieldErrors = Record<string, string>;

export function distributeContainerMt(totalMt: number, count: number): number[] {
  if (count <= 0) return [];
  const per = Math.round((totalMt / count) * 1000) / 1000;
  const mts = Array.from({ length: count }, () => per);
  const sum = mts.reduce((a, b) => a + b, 0);
  const diff = Math.round((totalMt - sum) * 1000) / 1000;
  if (diff !== 0) mts[mts.length - 1] = Math.round((mts[mts.length - 1] + diff) * 1000) / 1000;
  return mts;
}

export function validateBasicDates(form: Partial<ContractForm>): FieldErrors {
  const errors: FieldErrors = {};
  const sent = form.contractSentDate ? new Date(form.contractSentDate) : null;
  const received = form.receivedDate ? new Date(form.receivedDate) : null;
  const marking = form.contractDate ? new Date(form.contractDate) : null;
  const production = form.signedContractReceivedDate ? new Date(form.signedContractReceivedDate) : null;

  if (sent && received && received < sent) {
    errors.receivedDate = 'Signed received date cannot be before final contract sent date.';
  }
  if (received && marking && marking < received) {
    errors.contractDate = 'Marking details date cannot be before signed contract received date.';
  }
  if (marking && production && production < marking) {
    errors.signedContractReceivedDate = 'Marking sent to production cannot be before marking details received.';
  }
  return errors;
}

export function validateStep(
  step: number,
  form: Partial<ContractForm>,
  containerProducts: ContainerProduct[],
  totalMt: number,
  options?: { requireAll?: boolean; activeContainerIdx?: number },
): { valid: boolean; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const requireAll = options?.requireAll ?? false;

  if (step === 0) {
    if (!form.officeId) errors.officeId = 'Office is required.';
    if (requireAll) {
      Object.assign(errors, validateBasicDates(form));
    }
  }

  if (step === 1) {
    if (!form.buyerId) errors.buyerId = 'Buyer is required.';
  }

  if (step === 2) {
    if (!form.totalMt || form.totalMt <= 0) errors.totalMt = 'Total quantity must be greater than zero.';
    const mts = containerProducts.map((c) => c.quantityMt ?? 0);
    if (mts.some((m) => m <= 0)) {
      errors.quantityMt = 'Each container must have allocated MT greater than zero.';
    }
    if (form.totalMt && !validateContainerQuantities(form.totalMt, mts)) {
      errors.quantityMt = `Total allocated MT (${mts.reduce((a, b) => a + b, 0).toFixed(3)}) must equal contract quantity (${form.totalMt} MT).`;
    }
    // Every container must be filled before leaving Quantity step
    containerProducts.forEach((c, i) => {
      if (!c.expectedShipmentDate) {
        errors[`container_${i}_expectedShipmentDate`] = `Container ${i + 1}: expected shipment date is required.`;
      }
      if (!c.destinationPortId) {
        errors[`container_${i}_destinationPortId`] = `Container ${i + 1}: destination port is required.`;
      }
    });
  }

  if (step === 3) {
    containerProducts.forEach((c, i) => {
      const lines = c.products?.length ? c.products : c.productId ? [{ ...c, quantityMt: c.quantityMt ?? 0 }] : [];
      if (!lines.length) {
        errors[`container_${i}_productId`] = `Container ${i + 1}: at least one product is required.`;
        return;
      }
      const sum = lines.reduce((s, p) => s + (p.quantityMt || 0), 0);
      const containerMt = c.quantityMt ?? 0;
      if (containerMt > 0 && Math.abs(sum - containerMt) > 0.001) {
        errors[`container_${i}_products`] =
          `Container ${i + 1}: total product quantity (${sum.toFixed(3)} MT) must match container quantity (${containerMt} MT).`;
      }
      const isCurrent = options?.activeContainerIdx === i;
      if (requireAll || isCurrent || true) {
        lines.forEach((p, pi) => {
          if (!p.productId) errors[`container_${i}_product_${pi}`] = `Container ${i + 1} row ${pi + 1}: product is required.`;
          if (!p.specification && !c.specification) {
            errors[`container_${i}_spec_${pi}`] = `Container ${i + 1} row ${pi + 1}: specification is required.`;
          }
        });
      }
    });
  }

  if (step === 4) {
    containerProducts.forEach((c, i) => {
      const isCurrent = options?.activeContainerIdx === i;
      if (requireAll || isCurrent) {
        if (!c.fobPrice || c.fobPrice <= 0) errors[`container_${i}_fobPrice`] = 'FOB price is required.';
        if (!c.exchangeRate || c.exchangeRate <= 0) errors[`container_${i}_exchangeRate`] = 'Exchange rate is required.';
        const term = (c.incoterm ?? 'FOB').toUpperCase();
        if (term !== 'FOB' && (c.totalFreight == null || c.totalFreight < 0)) {
          errors[`container_${i}_totalFreight`] = 'Total freight cannot be negative.';
        }
      }
    });
  }

  if (step === 5) {
    if (requireAll && !form.paymentType) errors.paymentType = 'Payment type is required.';
    if (
      (form.paymentType === 'OTHERS' || form.balancePaymentMode === 'OTHERS') &&
      !form.otherPaymentMethod?.trim()
    ) {
      errors.otherPaymentMethod = 'Please specify the other payment method.';
    }
    containerProducts.forEach((c, i) => {
      const isCurrent = options?.activeContainerIdx === i;
      if (requireAll || isCurrent) {
        const hasPack =
          c.packagingTypeId ||
          c.packingDescription ||
          c.products?.some((p) => p.packagingTypeId || p.packingDescription);
        if (!hasPack) {
          errors[`container_${i}_packaging`] = 'Packaging type or description is required.';
        }
      }
    });
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function containerStepComplete(cp: ContainerProduct, step: 'product' | 'commercial' | 'packaging'): boolean {
  if (step === 'product') return !!cp.productId && !!cp.specification;
  if (step === 'commercial') return !!cp.fobPrice && !!cp.exchangeRate;
  if (step === 'packaging') return !!cp.packagingTypeId || !!cp.packingDescription;
  return false;
}
