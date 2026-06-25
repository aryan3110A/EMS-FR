const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function parseErrorMessage(body: unknown, statusText: string): string {
  if (!body || typeof body !== 'object') return statusText || 'Request failed';
  const record = body as { message?: unknown; error?: unknown };
  const raw = record.message ?? record.error;
  if (typeof raw === 'string' && raw.trim()) return raw;
  if (Array.isArray(raw)) return raw.filter((m) => typeof m === 'string').join(', ') || statusText;
  return statusText || 'Request failed';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ems_token') : null;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/login')) {
      localStorage.removeItem('ems_token');
      localStorage.removeItem('ems_user');
      window.location.href = '/login';
    }
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, parseErrorMessage(err, res.statusText));
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/auth/me'),
  offices: () => request<Office[]>('/offices'),
  createOffice: (data: { name: string; city?: string }) =>
    request<Office>('/offices', { method: 'POST', body: JSON.stringify(data) }),
  dashboard: (params?: Record<string, any>) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          cleanParams[key] = String(val);
        }
      });
    }
    const q = Object.keys(cleanParams).length ? '?' + new URLSearchParams(cleanParams).toString() : '';
    return request<DashboardStats>(`/contracts/dashboard${q}`);
  },
  contracts: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Contract[]>(`/contracts${q}`);
  },
  contract: (id: string) => request<Contract>(`/contracts/${id}`),
  createContract: (data: Partial<ContractForm>) =>
    request<Contract>('/contracts', { method: 'POST', body: JSON.stringify(toContractApiPayload(data)) }),
  submitContract: (data: SubmitContractPayload) =>
    request<Contract>('/contracts/submit', {
      method: 'POST',
      body: JSON.stringify({
        contract: toContractApiPayload(data.contract),
        pendingMasters: data.pendingMasters,
        buyerUpdate: data.buyerUpdate,
      }),
    }),
  updateContract: (id: string, data: Partial<ContractForm>) =>
    request<Contract>(`/contracts/${id}`, { method: 'PATCH', body: JSON.stringify(toContractApiPayload(data)) }),
  exchangeRate: (currency: string) =>
    request<{ rate: number; source: string; fetchedAt: string }>(
      `/contracts/exchange-rate?currency=${encodeURIComponent(currency)}`,
    ),
  amendContainerCommercial: (
    contractId: string,
    containerId: string,
    data: { reason: string; newPrice: number; currency: string },
  ) =>
    request<Contract>(`/contracts/${contractId}/containers/${containerId}/amend-commercial`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  contractAudit: (id: string) => request<unknown[]>(`/contracts/${id}/audit`),
  allAudits: () => request<any[]>('/contracts/audit/all'),
  notifications: () =>
    request<{ id: string; message: string; contractId?: string; createdAt: string; readAt?: string | null }[]>(
      '/notifications',
    ),
  markNotificationRead: (id: string) =>
    request<{ id: string }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  masters: {
    salespersons: () => request<Salesperson[]>('/masters/salespersons'),
    buyers: (officeId?: string, search?: string, includeInactive?: boolean) => {
      const params = new URLSearchParams();
      if (officeId) params.set('officeId', officeId);
      if (search) params.set('search', search);
      if (includeInactive) params.set('includeInactive', 'true');
      const q = params.toString() ? `?${params.toString()}` : '';
      return request<Buyer[]>(`/masters/buyers${q}`);
    },
    updateBuyer: (
      id: string,
      data: Partial<
        Pick<Buyer, 'address' | 'contactPerson' | 'email' | 'phone' | 'euClassification' | 'code'> & {
          countryId?: string;
          defaultPortId?: string;
        }
      >,
    ) => request<Buyer>(`/masters/buyers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    products: () => request<Product[]>('/masters/products'),
    packaging: () => request<PackagingType[]>('/masters/packaging'),
    ports: (includeInactive?: boolean) => {
      const q = includeInactive ? '?includeInactive=true' : '';
      return request<Port[]>(`/masters/ports${q}`);
    },
    countries: () => request<Country[]>('/masters/countries'),
    createCountry: (data: { name: string; euClassification?: string; code?: string }) =>
      request<Country>('/masters/countries', { method: 'POST', body: JSON.stringify(data) }),
    createSalesperson: (data: { name: string; phone?: string }) =>
      request<Salesperson>('/masters/salespersons', { method: 'POST', body: JSON.stringify(data) }),
    createBuyer: (data: { name: string; countryId: string; officeId?: string; code?: string }) =>
      request<Buyer>('/masters/buyers', { method: 'POST', body: JSON.stringify(data) }),
    createPort: (data: { name: string; countryId: string; code?: string }) =>
      request<Port>('/masters/ports', { method: 'POST', body: JSON.stringify(data) }),
    updatePort: (id: string, data: { name?: string; code?: string; countryId?: string; isActive?: boolean }) =>
      request<Port>(`/masters/ports/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deactivateBuyer: (id: string) =>
      request<Buyer>(`/masters/buyers/${id}/deactivate`, { method: 'PATCH' }),
    createProduct: (data: { name: string; code?: string }) =>
      request<Product>('/masters/products', { method: 'POST', body: JSON.stringify(data) }),
    createProductVariant: (data: { productId: string; name: string; processingType?: string }) =>
      request<Product>('/masters/product-variants', { method: 'POST', body: JSON.stringify(data) }),
    createPackagingType: (data: { name: string; material?: string }) =>
      request<PackagingType>('/masters/packaging', { method: 'POST', body: JSON.stringify(data) }),
    createPackagingSize: (data: { packagingTypeId: string; weightValue: number; weightUnit?: string }) =>
      request<{ id: string; label: string; weightKg: number; weightUnit?: string }>('/masters/packaging/sizes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  officeId?: string;
  officeName?: string;
}

export interface Office {
  id: string;
  code: string;
  name: string;
  city: string;
}

export interface Salesperson {
  id: string;
  code: string;
  name: string;
}

export interface Buyer {
  id: string;
  code: string;
  name: string;
  address?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  euClassification?: string;
  isActive?: boolean;
  country?: { id: string; name: string; code: string; euClassification: string };
  defaultPort?: Port;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  defaultSpecification?: string;
  variants?: { id: string; code: string; name: string; processingType?: string }[];
}

export interface PackagingType {
  id: string;
  code: string;
  name: string;
  sizes?: { id: string; label: string; weightKg: number; weightUnit?: string }[];
}

export interface Port {
  id: string;
  name: string;
  code?: string;
  portType: string;
  isActive?: boolean;
  country?: { id?: string; name: string };
}

export interface Country {
  id: string;
  name: string;
  code: string;
  euClassification: string;
}

export interface ContainerProduct {
  productId: string;
  productVariantId?: string;
  processingType?: string;
  specification?: string;
  productRemarks?: string;
  destinationPortId?: string;
  shipmentMonthYear?: string;
  shipmentHalf?: 'FIRST_HALF' | 'SECOND_HALF';
  expectedShipmentDate?: string;
  containerNo?: string;
  quantityMt?: number;
  packagingTypeId?: string;
  packagingSizeId?: string;
  packingDescription?: string;
  packingSizeValue?: number;
  packingSizeUnit?: string;
  incoterm?: 'FOB' | 'CIF' | 'CNF';
  fobPrice?: number;
  fobCurrency?: string;
  exchangeRate?: number;
  exchangeRateAt?: string;
  exchangeRateSource?: string;
  exchangeRateManual?: boolean;
  totalFreight?: number;
  freightPerMt?: number;
  fobInrPerKg?: number;
  insurance?: number;
  cifPrice?: number;
  cnfPrice?: number;
  commercialRemarks?: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  receivedDate?: string;
  contractDate?: string;
  signedContractReceivedDate?: string;
  invoiceNumber?: string;
  totalMt: number;
  numberOfContainers: number;
  fobPrice?: number;
  freight?: number;
  freightUnit?: string;
  insurance?: number;
  cifPrice?: number;
  exchangeRate?: number;
  fobInrPerKg?: number;
  packingDescription?: string;
  paymentType?: string;
  advancePercentage?: number;
  balancePaymentStage?: string;
  shipmentMonth?: string;
  shipmentHalf?: string;
  status: string;
  incoterm?: string;
  euClassification?: string;
  buyerLotNo?: string;
  contractSentDate?: string;
  contractOnBehalfOf?: string;
  processingType?: string;
  quantityUnit?: string;
  qualityRequirement?: string;
  productRemarks?: string;
  buyerRemarks?: string;
  fobPriceUnit?: string;
  fobCurrency?: string;
  originalContractPrice?: number;
  amendmentPrice?: number;
  amendmentCurrency?: string;
  amendmentDate?: string;
  amendmentReason?: string;
  commercialRemarks?: string;
  internalRemarks?: string;
  specification?: string;
  productionInformed?: boolean;
  containerNo?: string;
  remarks?: string;
  office?: Office;
  salesperson?: Salesperson;
  buyer?: Buyer;
  product?: Product;
  productVariant?: { name: string };
  destinationPort?: Port;
  packagingSize?: { label: string };
  lots?: { lotNumber: string; quantityMt: number; shipmentMonth?: string }[];
  containers?: ContractContainer[];
}

export interface ContractContainer {
  id: string;
  containerIndex: number;
  productId: string;
  productVariantId?: string;
  processingType?: string;
  specification?: string;
  productRemarks?: string;
  quantityMt?: number;
  containerNo?: string;
  destinationPortId?: string;
  expectedShipmentDate?: string;
  shipmentMonth?: string;
  shipmentYear?: number;
  shipmentHalf?: string;
  incoterm?: string;
  fobPrice?: number;
  fobCurrency?: string;
  exchangeRate?: number;
  exchangeRateAt?: string;
  exchangeRateSource?: string;
  fobInrPerKg?: number;
  totalFreight?: number;
  freightPerMt?: number;
  insurance?: number;
  cifPrice?: number;
  cnfPrice?: number;
  originalCifCnfPrice?: number;
  currentCifCnfPrice?: number;
  commercialRemarks?: string;
  containerStatus?: string;
  packagingTypeId?: string;
  packagingSizeId?: string;
  packingDescription?: string;
  packingSizeValue?: number;
  packingSizeUnit?: string;
  packagingType?: { code: string; name: string };
  packagingSize?: { label: string };
  product?: Product;
  productVariant?: { id?: string; name: string };
  destinationPort?: Port;
  amendments?: {
    id: string;
    incoterm: string;
    previousValue: number;
    amendedValue: number;
    currency: string;
    reason: string;
    amendmentDate: string;
    amendedBy?: { name: string };
  }[];
}

export interface ContractForm {
  officeId: string;
  // Section A
  contractNumber?: string;
  contractSentDate?: string;
  receivedDate?: string;
  contractDate?: string;
  signedContractReceivedDate?: string;
  salespersonId?: string;
  contractOnBehalfOf?: string;
  invoiceNumber?: string;
  remarks?: string;
  internalRemarks?: string;
  status?: string;
  // Section B
  buyerId: string;
  buyerCode?: string;
  buyerCountryId?: string;
  euClassification?: string;
  buyerAddress?: string;
  buyerContactPerson?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerRemarks?: string;
  buyerLotNo?: string;
  // Section C
  productId: string;
  productVariantId?: string;
  processingType?: string;
  totalMt: number;
  quantityUnit?: string;
  specification?: string;
  qualityRequirement?: string;
  productRemarks?: string;
  containerProducts?: (ContainerProduct & { containerIndex?: number; quantityMt?: number })[];
  // Section D
  incoterm?: string;
  fobPrice?: number;
  fobCurrency?: string;
  fobPriceUnit?: string;
  freight?: number;
  freightUnit?: string;
  insurance?: number;
  cifPrice?: number;
  cifManualOverride?: boolean;
  exchangeRate?: number;
  originalContractPrice?: number;
  amendmentPrice?: number;
  amendmentCurrency?: string;
  amendmentDate?: string;
  amendmentReason?: string;
  commercialRemarks?: string;
  // Later sections
  numberOfContainers?: number;
  shipmentMonthYear?: string;
  shipmentHalf?: 'FIRST_HALF' | 'SECOND_HALF';
  shipmentMonth?: string;
  shipmentYear?: number;
  packagingTypeId?: string;
  packagingSizeId?: string;
  packingDescription?: string;
  packingSizeValue?: number;
  packingSizeUnit?: string;
  packingSizeUnitCustom?: string;
  useCustomPackingSize?: boolean;
  paymentType?: string;
  advancePercentage?: number;
  balancePaymentMode?: string;
  balancePaymentStage?: string;
  destinationPortId?: string;
  expectedShipmentDate?: string;
  containerNo?: string;
}

/** UI-only fields kept on ContractForm but rejected by CreateContractDto */
const CONTRACT_FORM_ONLY_KEYS = [
  'buyerCode',
  'buyerCountryId',
  'buyerAddress',
  'buyerContactPerson',
  'buyerEmail',
  'buyerPhone',
  'shipmentMonthYear',
  'packingSizeUnitCustom',
  'useCustomPackingSize',
] as const satisfies readonly (keyof ContractForm)[];

export function toContractApiPayload(data: Partial<ContractForm>): Partial<ContractForm> {
  const payload = { ...data };
  for (const key of CONTRACT_FORM_ONLY_KEYS) {
    delete payload[key];
  }
  return payload;
}

export type SubmitContractPayload = {
  contract: Partial<ContractForm>;
  pendingMasters?: import('./pending-masters').PendingMasters;
  buyerUpdate?: {
    address?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    euClassification?: string;
    code?: string;
    countryId?: string;
  };
};

export interface DashboardStats {
  total: number;
  draft: number;
  awaitingSigned: number;
  confirmed: number;
  inProduction: number;
  ready: number;
  underPreparation?: number;
  containersShipped?: number;
  containersReachedPort?: number;
  recent: Contract[];
  upcoming?: {
    from: string;
    to: string;
    totalContainers: number;
    totalMt: number;
    contractCount: number;
    productCount: number;
    byProduct: { code: string; name: string; containers: number; mt: number; contracts: string[] }[];
    byPeriod: { FIRST_HALF: number; SECOND_HALF: number };
    shipments: {
      id: string;
      contractId: string;
      contractNumber: string;
      containerIndex: number;
      buyer?: string;
      product?: string;
      quantityMt?: number;
      expectedShipmentDate?: string;
      destinationPort?: string;
      shipmentHalf?: string;
      status?: string;
    }[];
  };
  shipped?: {
    totalContainers: number;
    totalMt: number;
    byProduct: {
      code: string;
      name: string;
      quantity: number;
      containers: number;
      contracts: string[];
      contractMap?: Record<string, string>;
    }[];
  };
  allContainers?: any[];
}
