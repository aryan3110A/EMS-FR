import type { Buyer, Country, Office, PackagingType, Product, Salesperson } from './api';

export const PENDING_PREFIX = 'pending:';

export type PendingMasters = {
  offices: Array<{ id: string; name: string; city?: string }>;
  salespersons: Array<{ id: string; name: string }>;
  countries: Array<{ id: string; name: string; euClassification: string }>;
  buyers: Array<{ id: string; name: string; countryId: string }>;
  products: Array<{
    id: string;
    name: string;
    code: string;
    defaultSpecification?: string;
    variants: Array<{ id: string; name: string; code: string; processingType?: string }>;
  }>;
  productVariants: Array<{ id: string; productId: string; name: string; processingType?: string }>;
  packagingTypes: Array<{ id: string; name: string; code: string }>;
  packagingSizes: Array<{
    id: string;
    packagingTypeId: string;
    label: string;
    weightKg: number;
    weightUnit: string;
    weightValue: number;
  }>;
};

export function emptyPendingMasters(): PendingMasters {
  return {
    offices: [],
    salespersons: [],
    countries: [],
    buyers: [],
    products: [],
    productVariants: [],
    packagingTypes: [],
    packagingSizes: [],
  };
}

export function hasPendingMasters(pending: PendingMasters): boolean {
  return (
    pending.offices.length > 0 ||
    pending.salespersons.length > 0 ||
    pending.countries.length > 0 ||
    pending.buyers.length > 0 ||
    pending.products.length > 0 ||
    pending.productVariants.length > 0 ||
    pending.packagingTypes.length > 0 ||
    pending.packagingSizes.length > 0
  );
}

export function findExistingBuyerByName(buyers: Buyer[], name: string): Buyer | undefined {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;
  return buyers.find((b) => b.name.trim().toLowerCase() === normalized);
}

export function createPendingId(kind: string) {
  return `${PENDING_PREFIX}${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function isPendingId(id?: string | null): boolean {
  return !!id && id.startsWith(PENDING_PREFIX);
}

function productCodeFromName(name: string) {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 8) || 'NEW'
  );
}

export function mergeOffices(db: Office[], pending: PendingMasters): Office[] {
  return [...db, ...pending.offices.map((o) => ({ id: o.id, code: o.name.slice(0, 6).toUpperCase(), name: o.name, city: o.city || o.name }))].sort(
    (a, b) => a.name.localeCompare(b.name),
  );
}

export function mergeSalespersons(db: Salesperson[], pending: PendingMasters): Salesperson[] {
  return [
    ...db,
    ...pending.salespersons.map((s) => ({ id: s.id, code: s.name.slice(0, 8).toUpperCase(), name: s.name })),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

export function mergeCountries(db: Country[], pending: PendingMasters): Country[] {
  return [
    ...db,
    ...pending.countries.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.name.slice(0, 2).toUpperCase(),
      euClassification: c.euClassification,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

export function mergeBuyers(db: Buyer[], pending: PendingMasters, countries: Country[]): Buyer[] {
  return [
    ...db,
    ...pending.buyers.map((b) => {
      const country = countries.find((c) => c.id === b.countryId);
      return {
        id: b.id,
        code: b.name.slice(0, 8).toUpperCase(),
        name: b.name,
        country: country
          ? { id: country.id, name: country.name, code: country.code, euClassification: country.euClassification }
          : undefined,
      } as Buyer;
    }),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

export function mergeProducts(db: Product[], pending: PendingMasters): Product[] {
  const merged = [...db];
  for (const p of pending.products) {
    merged.push({
      id: p.id,
      code: p.code,
      name: p.name,
      defaultSpecification: p.defaultSpecification,
      variants: p.variants.map((v) => ({ id: v.id, code: v.code, name: v.name, processingType: v.processingType })),
    });
  }
  for (const pv of pending.productVariants) {
    const product = merged.find((p) => p.id === pv.productId);
    if (product) {
      product.variants = [
        ...(product.variants || []),
        { id: pv.id, code: pv.name.toUpperCase().replace(/\s+/g, '_'), name: pv.name, processingType: pv.processingType },
      ];
    }
  }
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export function mergePackaging(db: PackagingType[], pending: PendingMasters): PackagingType[] {
  const merged = db.map((p) => ({ ...p, sizes: [...(p.sizes || [])] }));
  for (const pt of pending.packagingTypes) {
    merged.push({ id: pt.id, code: pt.code, name: pt.name, sizes: [] });
  }
  for (const ps of pending.packagingSizes) {
    const type = merged.find((p) => p.id === ps.packagingTypeId);
    if (type) {
      type.sizes = [...(type.sizes || []), { id: ps.id, label: ps.label, weightKg: ps.weightKg, weightUnit: ps.weightUnit }];
    }
  }
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export function addPendingOffice(pending: PendingMasters, name: string): { pending: PendingMasters; office: Office } {
  const item = { id: createPendingId('office'), name: name.trim(), city: name.trim() };
  return {
    pending: { ...pending, offices: [...pending.offices, item] },
    office: { id: item.id, code: item.name.slice(0, 6).toUpperCase(), name: item.name, city: item.city! },
  };
}

export function addPendingSalesperson(pending: PendingMasters, name: string): { pending: PendingMasters; sp: Salesperson } {
  const item = { id: createPendingId('salesperson'), name: name.trim() };
  return {
    pending: { ...pending, salespersons: [...pending.salespersons, item] },
    sp: { id: item.id, code: item.name.slice(0, 8).toUpperCase(), name: item.name },
  };
}

export function addPendingCountry(
  pending: PendingMasters,
  name: string,
  euClassification: string,
): { pending: PendingMasters; country: Country } {
  const item = { id: createPendingId('country'), name: name.trim(), euClassification };
  return {
    pending: { ...pending, countries: [...pending.countries, item] },
    country: { id: item.id, name: item.name, code: item.name.slice(0, 2).toUpperCase(), euClassification: item.euClassification },
  };
}

export function addPendingBuyer(
  pending: PendingMasters,
  name: string,
  countryId: string,
  countries: Country[],
): { pending: PendingMasters; buyer: Buyer } {
  const item = { id: createPendingId('buyer'), name: name.trim(), countryId };
  const country = countries.find((c) => c.id === countryId);
  return {
    pending: { ...pending, buyers: [...pending.buyers, item] },
    buyer: {
      id: item.id,
      code: item.name.slice(0, 8).toUpperCase(),
      name: item.name,
      country: country
        ? { id: country.id, name: country.name, code: country.code, euClassification: country.euClassification }
        : undefined,
    },
  };
}

export function addPendingProduct(pending: PendingMasters, name: string): { pending: PendingMasters; product: Product } {
  const id = createPendingId('product');
  const code = productCodeFromName(name);
  const normalVariant = {
    id: createPendingId('variant'),
    name: 'Normal',
    code: 'NORMAL',
    processingType: 'Normal',
  };
  const item = { id, name: name.trim(), code, variants: [normalVariant] };
  return {
    pending: { ...pending, products: [...pending.products, item] },
    product: {
      id: item.id,
      code: item.code,
      name: item.name,
      variants: [{ id: normalVariant.id, code: normalVariant.code, name: normalVariant.name, processingType: normalVariant.processingType }],
    },
  };
}

export function addPendingProductVariant(
  pending: PendingMasters,
  productId: string,
  name: string,
  processingType: string | undefined,
  products: Product[],
): { pending: PendingMasters; product: Product; variantId: string } {
  const variantId = createPendingId('variant');
  const pv = { id: variantId, productId, name: name.trim(), processingType: processingType?.trim() || name.trim() };
  let nextPending: PendingMasters = { ...pending, productVariants: [...pending.productVariants, pv] };

  const pendingProduct = pending.products.find((p) => p.id === productId);
  if (pendingProduct) {
    nextPending = {
      ...nextPending,
      products: pending.products.map((p) =>
        p.id === productId
          ? {
              ...p,
              variants: [
                ...p.variants,
                { id: variantId, name: pv.name, code: pv.name.toUpperCase().replace(/\s+/g, '_'), processingType: pv.processingType },
              ],
            }
          : p,
      ),
    };
  }

  const product = mergeProducts(products, nextPending).find((p) => p.id === productId)!;
  return { pending: nextPending, product, variantId };
}

export function addPendingPackagingType(pending: PendingMasters, name: string): { pending: PendingMasters; pkg: PackagingType } {
  const item = { id: createPendingId('packaging'), name: name.trim(), code: name.trim().toUpperCase().slice(0, 8) };
  return {
    pending: { ...pending, packagingTypes: [...pending.packagingTypes, item] },
    pkg: { id: item.id, code: item.code, name: item.name, sizes: [] },
  };
}

export function addPendingPackagingSize(
  pending: PendingMasters,
  packagingTypeId: string,
  weightValue: number,
  weightUnit: string,
  packagingTypes: PackagingType[],
): { pending: PendingMasters; size: { id: string; label: string; weightKg: number; weightUnit: string } } {
  const type = mergePackaging(packagingTypes, pending).find((p) => p.id === packagingTypeId);
  const unit = weightUnit.toUpperCase();
  const label = `${(type?.name || 'PACKING').toUpperCase()} OF ${weightValue} ${unit} NET`;
  const item = {
    id: createPendingId('packsize'),
    packagingTypeId,
    label,
    weightKg: unit === 'G' ? weightValue / 1000 : weightValue,
    weightUnit: unit,
    weightValue,
  };
  return {
    pending: { ...pending, packagingSizes: [...pending.packagingSizes, item] },
    size: { id: item.id, label: item.label, weightKg: item.weightKg, weightUnit: item.weightUnit },
  };
}
