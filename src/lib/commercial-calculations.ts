/** PDF §24 calculation rules — mirrors backend CalculationService */

export const DEFAULT_FOB_DEDUCTION = 70;
export const PRODUCT_SPECIFICATIONS = ['99.98%', '99.95%', '99.90%', '99%'] as const;
export type IncotermType = 'FOB' | 'CIF' | 'CNF';

export function calculateFreightPerMt(totalFreight: number, containerMt: number): number {
  if (!containerMt || containerMt <= 0) return 0;
  return totalFreight / containerMt;
}

export function calculateFobInrPerKg(
  fobPrice: number,
  exchangeRate: number,
  fobDeduction = DEFAULT_FOB_DEDUCTION,
): number {
  return ((fobPrice - fobDeduction) * exchangeRate) / 1000;
}

export function calculateCif(fob: number, freightPerMt: number, insurance = 0): number {
  return fob + freightPerMt + insurance;
}

export function calculateCnf(fob: number, freightPerMt: number): number {
  return fob + freightPerMt;
}

export type ContainerCommercialInput = {
  incoterm?: IncotermType;
  fobPrice?: number;
  exchangeRate?: number;
  quantityMt?: number;
  totalFreight?: number;
  insurance?: number;
};

export function enrichContainerCommercial(input: ContainerCommercialInput) {
  const incoterm = (input.incoterm ?? 'FOB').toUpperCase() as IncotermType;
  const fob = input.fobPrice ?? 0;
  const rate = input.exchangeRate ?? 0;
  const mt = input.quantityMt ?? 0;
  const totalFreight = input.totalFreight ?? 0;
  const insurance = input.insurance ?? 0;

  const freightPerMt =
    incoterm === 'FOB' ? undefined : calculateFreightPerMt(totalFreight, mt);

  const fobInrPerKg =
    fob > 0 && rate > 0 ? calculateFobInrPerKg(fob, rate) : undefined;

  let cifPrice: number | undefined;
  let cnfPrice: number | undefined;

  if (incoterm === 'CIF' && freightPerMt != null) {
    cifPrice = calculateCif(fob, freightPerMt, insurance);
  } else if (incoterm === 'CNF' && freightPerMt != null) {
    cnfPrice = calculateCnf(fob, freightPerMt);
  }

  return { freightPerMt, fobInrPerKg, cifPrice, cnfPrice };
}

/** PDF §15 visibility matrix */
export function commercialFieldVisibility(incoterm: IncotermType) {
  const term = incoterm.toUpperCase() as IncotermType;
  return {
    totalFreight: term !== 'FOB',
    freightPerMt: term !== 'FOB',
    insurance: term === 'CIF',
    cifPrice: term === 'CIF',
    cnfPrice: term === 'CNF',
    changeAmendment: term === 'CIF' || term === 'CNF',
  };
}

export function validateContainerQuantities(totalMt: number, containerMts: number[]): boolean {
  const sum = Math.round(containerMts.reduce((a, b) => a + b, 0) * 1000) / 1000;
  const total = Math.round(totalMt * 1000) / 1000;
  return sum === total;
}
