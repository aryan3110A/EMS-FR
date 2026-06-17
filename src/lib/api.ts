const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
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
    throw new ApiError(res.status, err.message || 'Request failed');
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
  dashboard: () => request<DashboardStats>('/contracts/dashboard'),
  contracts: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Contract[]>(`/contracts${q}`);
  },
  contract: (id: string) => request<Contract>(`/contracts/${id}`),
  createContract: (data: Partial<ContractForm>) =>
    request<Contract>('/contracts', { method: 'POST', body: JSON.stringify(data) }),
  updateContract: (id: string, data: Partial<ContractForm>) =>
    request<Contract>(`/contracts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  masters: {
    salespersons: () => request<Salesperson[]>('/masters/salespersons'),
    buyers: () => request<Buyer[]>('/masters/buyers'),
    updateBuyer: (id: string, data: Partial<Pick<Buyer, 'address' | 'contactPerson' | 'email' | 'phone' | 'euClassification'>>) =>
      request<Buyer>(`/masters/buyers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    products: () => request<Product[]>('/masters/products'),
    packaging: () => request<PackagingType[]>('/masters/packaging'),
    ports: () => request<Port[]>('/masters/ports'),
    countries: () => request<Country[]>('/masters/countries'),
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
  country?: { name: string; code: string; euClassification: string };
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
  sizes?: { id: string; label: string; weightKg: number }[];
}

export interface Port {
  id: string;
  name: string;
  portType: string;
  country?: { name: string };
}

export interface Country {
  id: string;
  name: string;
  code: string;
  euClassification: string;
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
  packagingTypeId?: string;
  packagingSizeId?: string;
  packingDescription?: string;
  paymentType?: string;
  advancePercentage?: number;
  balancePaymentMode?: string;
  balancePaymentStage?: string;
  destinationPortId?: string;
  expectedShipmentDate?: string;
  containerNo?: string;
}

export interface DashboardStats {
  total: number;
  draft: number;
  awaitingSigned: number;
  confirmed: number;
  inProduction: number;
  ready: number;
  recent: Contract[];
}
