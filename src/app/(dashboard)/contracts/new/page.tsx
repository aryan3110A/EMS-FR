'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/sidebar';
import { Field, ReadOnly, StepPills, CONTRACT_STATUSES, ReviewSection, ReviewField } from '@/components/contracts/form-fields';
import { ContainerProductSection } from '@/components/contracts/container-product-section';
import { ContainerShipmentSection } from '@/components/contracts/container-shipment-section';
import { ContainerCommercialSection } from '@/components/contracts/container-commercial-section';
import { AddBuyerModal } from '@/components/buyers/add-buyer-modal';
import { AddPortModal } from '@/components/ports/add-port-modal';
import { BASIC_DATE_LABELS } from '@/lib/contract-labels';
import { buildContainerProductsPayload } from '@/lib/contract-form-mapper';
import { distributeContainerMt, validateStep, containerStepComplete } from '@/lib/contract-validation';
import { enrichContainerCommercial } from '@/lib/commercial-calculations';
import { ContainerTabs } from '@/components/contracts/container-tabs';
import { ContainerPackagingSection } from '@/components/contracts/container-packaging-section';
import { FieldError } from '@/components/contracts/field-error';
import { AutosaveIndicator, useAutosave } from '@/hooks/use-autosave';
import { EmsSelect } from '@/components/ui/ems-select';
import { InlineAddPanel } from '@/components/ui/inline-add-panel';
import { api, ContractForm, ContainerProduct, Salesperson, Buyer, Product, PackagingType, Port, Office, Country } from '@/lib/api';
import {
  addPendingBuyer,
  addPendingCountry,
  addPendingOffice,
  addPendingPackagingSize,
  addPendingPackagingType,
  addPendingProduct,
  addPendingProductVariant,
  addPendingSalesperson,
  emptyPendingMasters,
  findExistingBuyerByName,
  hasPendingMasters,
  mergeBuyers,
  mergeCountries,
  mergeOffices,
  mergePackaging,
  mergeProducts,
  mergeSalespersons,
  type PendingMasters,
} from '@/lib/pending-masters';
import { invalidateQueryCache } from '@/lib/use-cached-query';
import { showError, showInfo, showSuccess } from '@/lib/toast';
import { ADD_OPTION_VALUE, BALANCE_PAYMENT_METHODS, PACKING_SIZE_UNITS } from '@/lib/form-constants';
import {
  formatShipmentMonthDb,
  formatShipmentPeriodLabel,
} from '@/lib/shipment-period';
import { ChevronLeft, ChevronRight, Save, ShieldAlert } from 'lucide-react';

const STEPS = ['Basic Info', 'Buyer', 'Quantity', 'Product', 'Commercial', 'Packaging & Payment', 'Review'];

function emptyContainerProduct(): ContainerProduct {
  return {
    productId: '',
    productVariantId: '',
    processingType: '',
    specification: '',
    productRemarks: '',
    products: [{ productIndex: 1, productId: '', quantityMt: 0 }],
    destinationPortId: '',
    shipmentMonthYear: '',
    shipmentHalf: undefined,
    expectedShipmentDate: '',
    containerNo: '',
    factorySealNo: '',
    shippingLineSealNo: '',
  };
}

export default function NewContractPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('ems_user') || '{}');
      setUserRole(u.role || 'GUEST');
    } catch {
      setUserRole('GUEST');
    }
  }, []);
  const [masters, setMasters] = useState<{
    offices: Office[];
    salespersons: Salesperson[];
    buyers: Buyer[];
    products: Product[];
    packaging: PackagingType[];
    ports: Port[];
    countries: Country[];
  }>({ offices: [], salespersons: [], buyers: [], products: [], packaging: [], ports: [], countries: [] });
  const [pendingMasters, setPendingMasters] = useState<PendingMasters>(emptyPendingMasters);

  const mergedOffices = useMemo(() => mergeOffices(masters.offices, pendingMasters), [masters.offices, pendingMasters]);
  const mergedSalespersons = useMemo(
    () => mergeSalespersons(masters.salespersons, pendingMasters),
    [masters.salespersons, pendingMasters],
  );
  const mergedCountries = useMemo(
    () => mergeCountries(masters.countries, pendingMasters),
    [masters.countries, pendingMasters],
  );
  const mergedBuyers = useMemo(
    () => mergeBuyers(masters.buyers, pendingMasters, mergedCountries),
    [masters.buyers, pendingMasters, mergedCountries],
  );
  const mergedProducts = useMemo(
    () => mergeProducts(masters.products, pendingMasters),
    [masters.products, pendingMasters],
  );

  const mergedPackaging = useMemo(
    () => mergePackaging(masters.packaging, pendingMasters),
    [masters.packaging, pendingMasters],
  );

  const [addPanel, setAddPanel] = useState<
    | 'office'
    | 'salesperson'
    | 'buyer'
    | 'country'
    | 'country-new-buyer'
    | 'packaging'
    | 'packagingSize'
    | null
  >(null);
  const [productAdd, setProductAdd] = useState<{ panel: 'product' | 'variant'; containerIndex: number } | null>(null);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [showPortModal, setShowPortModal] = useState(false);
  const [portModalIndex, setPortModalIndex] = useState(0);
  const [activeContainerIdx, setActiveContainerIdx] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draftContractId, setDraftContractId] = useState<string | null>(null);
  const draftContractIdRef = useRef<string | null>(null);
  const isSavingDraftRef = useRef(false);
  const [refreshingIdx, setRefreshingIdx] = useState<number | null>(null);
  const [containerProducts, setContainerProducts] = useState<ContainerProduct[]>([emptyContainerProduct()]);
  const [newBuyerCountryId, setNewBuyerCountryId] = useState('');
  const [newCountryEu, setNewCountryEu] = useState('NON_EU');

  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ems_user') || '{}') : {};

  const [form, setForm] = useState<ContractForm>({
    officeId: '',
    contractDate: new Date().toISOString().slice(0, 10),
    buyerId: '',
    productId: '',
    totalMt: 28,
    quantityUnit: 'MT',
    numberOfContainers: 1,
    fobCurrency: 'USD',
    fobPriceUnit: 'PER_MT',
    incoterm: 'FOB',
    paymentType: 'ADVANCE',
    advancePercentage: 10,
    status: 'DRAFT',
    cifManualOverride: false,
    packingSizeUnit: 'KG',
  });

  useEffect(() => {
    if (step !== 1) return;
    api.masters.buyers().then((buyers) => {
      setMasters((m) => ({ ...m, buyers }));
    });
  }, [step]);

  useEffect(() => {
    Promise.all([
      api.offices(),
      api.masters.salespersons(),
      api.masters.buyers(),
      api.masters.products(),
      api.masters.packaging(),
      api.masters.ports(),
      api.masters.countries(),
    ]).then(([offices, salespersons, buyers, products, packaging, ports, countries]) => {
      setMasters({ offices, salespersons, buyers, products, packaging, ports, countries });
      const amd = offices.find((o) => o.code === 'AMD') || offices[0];
      const assignedOffice = user.officeId
        ? offices.find((o) => o.id === user.officeId)?.id
        : undefined;
      setForm((f) => ({
        ...f,
        officeId: f.officeId || assignedOffice || amd?.id || '',
      }));
    });
  }, [user.officeId]);

  const selectedBuyer = mergedBuyers.find((b) => b.id === form.buyerId);
  const autoContainers = useMemo(() => Math.ceil((form.totalMt || 0) / 28), [form.totalMt]);
  const containers = form.numberOfContainers ?? autoContainers;

  useEffect(() => {
    setContainerProducts((prev) => {
      const n = Math.max(1, containers);
      const mts = distributeContainerMt(form.totalMt || 0, n);
      let next = [...prev];

      if (prev.length < n) {
        const defaultPortId = selectedBuyer?.defaultPort?.id;
        const added = Array.from({ length: n - prev.length }, () => ({
          ...emptyContainerProduct(),
          ...(defaultPortId ? { destinationPortId: defaultPortId } : {}),
        }));
        next = [...prev, ...added];
      } else if (prev.length > n) {
        next = prev.slice(0, n);
      }

      return next.map((c, i) => ({ ...c, quantityMt: mts[i] }));
    });
  }, [containers, form.totalMt]);

  useEffect(() => {
    const defaultPortId = selectedBuyer?.defaultPort?.id;
    if (!defaultPortId) return;
    setContainerProducts((prev) =>
      prev.map((cp, i) => (i === 0 && !cp.destinationPortId ? { ...cp, destinationPortId: defaultPortId } : cp)),
    );
  }, [selectedBuyer?.defaultPort?.id]);

  function updateContainerProduct(index: number, field: keyof ContainerProduct, value: string) {
    setContainerProducts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function patchContainerProduct(index: number, patch: Partial<ContainerProduct>) {
    setContainerProducts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function copyContainerFromPrevious(targetIndex: number) {
    if (targetIndex <= 0) return;
    setContainerProducts((prev) => {
      const source = prev[targetIndex - 1];
      const keep = prev[targetIndex];
      const next = [...prev];
      const copiedProducts = (source.products?.length ? source.products : [
        {
          productIndex: 1,
          productId: source.productId,
          productVariantId: source.productVariantId,
          processingType: source.processingType,
          specification: source.specification,
          quantityMt: keep.quantityMt ?? source.quantityMt ?? 0,
          packagingTypeId: source.packagingTypeId,
          packagingSizeId: source.packagingSizeId,
          packingDescription: source.packingDescription,
          productRemarks: source.productRemarks,
        },
      ]).map((p, i) => ({
        ...p,
        productIndex: i + 1,
        quantityMt: i === 0 ? (keep.quantityMt ?? p.quantityMt) : p.quantityMt,
      }));
      next[targetIndex] = {
        ...keep,
        products: copiedProducts,
        productId: copiedProducts[0]?.productId || '',
        productVariantId: copiedProducts[0]?.productVariantId,
        processingType: copiedProducts[0]?.processingType,
        specification: copiedProducts[0]?.specification,
        productRemarks: copiedProducts[0]?.productRemarks,
        packagingTypeId: copiedProducts[0]?.packagingTypeId || source.packagingTypeId,
        packagingSizeId: copiedProducts[0]?.packagingSizeId || source.packagingSizeId,
        packingDescription: copiedProducts[0]?.packingDescription || source.packingDescription,
        destinationPortId: source.destinationPortId,
        incoterm: source.incoterm,
        fobCurrency: source.fobCurrency,
        fobPrice: source.fobPrice,
        exchangeRate: source.exchangeRate,
        exchangeRateSource: source.exchangeRateSource,
        exchangeRateAt: source.exchangeRateAt,
        exchangeRateManual: source.exchangeRateManual,
        totalFreight: source.totalFreight,
        insurance: source.insurance,
        commercialRemarks: source.commercialRemarks,
      };
      return next;
    });
  }

  function copyContainerShipmentFromPrevious(targetIndex: number) {
    if (targetIndex <= 0) return;
    setContainerProducts((prev) => {
      const source = prev[targetIndex - 1];
      const next = [...prev];
      next[targetIndex] = {
        ...next[targetIndex],
        destinationPortId: source.destinationPortId,
        expectedShipmentDate: source.expectedShipmentDate,
        shipmentMonthYear: source.shipmentMonthYear,
        shipmentHalf: source.shipmentHalf,
        containerNo: source.containerNo,
      };
      return next;
    });
  }

  function copyContainerCommercialFromPrevious(targetIndex: number) {
    if (targetIndex <= 0) return;
    setContainerProducts((prev) => {
      const source = prev[targetIndex - 1];
      const next = [...prev];
      next[targetIndex] = {
        ...next[targetIndex],
        incoterm: source.incoterm,
        fobPrice: source.fobPrice,
        fobCurrency: source.fobCurrency,
        exchangeRate: source.exchangeRate,
        exchangeRateAt: source.exchangeRateAt,
        exchangeRateSource: source.exchangeRateSource,
        exchangeRateManual: source.exchangeRateManual,
        totalFreight: source.totalFreight,
        insurance: source.insurance,
        commercialRemarks: source.commercialRemarks,
      };
      return next;
    });
  }

  const packagingSizesForType = useMemo(() => {
    if (!form.packagingTypeId) return mergedPackaging.flatMap((p) => p.sizes || []);
    const pkg = mergedPackaging.find((p) => p.id === form.packagingTypeId);
    return pkg?.sizes || [];
  }, [mergedPackaging, form.packagingTypeId]);

  function setField<K extends keyof ContractForm>(key: K, value: ContractForm[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'totalMt' && typeof value === 'number') {
        next.numberOfContainers = Math.ceil(value / 28) || 1;
      }
      return next;
    });
  }

  function applyBuyerToForm(buyer: Buyer | undefined, buyerId: string) {
    setForm((f) => ({
      ...f,
      buyerId,
      buyerCode: buyer?.code || '',
      buyerCountryId: buyer?.country?.id || '',
      euClassification: buyer?.euClassification || buyer?.country?.euClassification || f.euClassification,
      buyerAddress: buyer?.address || '',
      buyerContactPerson: buyer?.contactPerson || '',
      buyerEmail: buyer?.email || '',
      buyerPhone: buyer?.phone || '',
    }));
    if (buyer?.defaultPort?.id) {
      setContainerProducts((prev) =>
        prev.map((cp, i) => (i === 0 ? { ...cp, destinationPortId: buyer.defaultPort!.id } : cp)),
      );
    }
  }

  function onBuyerChange(buyerId: string) {
    if (buyerId === ADD_OPTION_VALUE) {
      setShowBuyerModal(true);
      return;
    }
    const buyer = mergedBuyers.find((b) => b.id === buyerId);
    applyBuyerToForm(buyer, buyerId);
  }

  async function refreshExchangeRate(containerIndex: number, currencyOverride?: string) {
    const currency = currencyOverride || containerProducts[containerIndex].fobCurrency || 'USD';
    if (currencyOverride) {
      patchContainerProduct(containerIndex, { fobCurrency: currencyOverride });
    }
    setRefreshingIdx(containerIndex);
    try {
      const { rate, source, fetchedAt } = await api.exchangeRate(currency);
      patchContainerProduct(containerIndex, {
        exchangeRate: rate,
        exchangeRateSource: source,
        exchangeRateAt: fetchedAt,
        exchangeRateManual: false,
      });
    } catch (e) {
      showError(e, 'Failed to fetch exchange rate');
    } finally {
      setRefreshingIdx(null);
    }
  }

  function onBuyerCountryChange(countryId: string) {
    const country = mergedCountries.find((c) => c.id === countryId);
    setForm((f) => ({
      ...f,
      buyerCountryId: countryId,
      euClassification: country?.euClassification || f.euClassification,
    }));
  }

  function addLocalCountry(name: string, euClassification = newCountryEu) {
    const { pending, country } = addPendingCountry(pendingMasters, name, euClassification);
    setPendingMasters(pending);
    return country;
  }

  const countryOptions = useMemo(
    () => [
      { value: '', label: 'Select country' },
      ...mergedCountries.map((c) => ({ value: c.id, label: c.name })),
      { value: ADD_OPTION_VALUE, label: '+ Add other country' },
    ],
    [mergedCountries],
  );

  function goToStep(nextStep: number) {
    setStep(nextStep);
    setActiveContainerIdx(0);
  }

  function goNext() {
    const { valid, errors } = validateStep(step, form, containerProducts, form.totalMt, { activeContainerIdx });
    setFieldErrors(errors);
    if (!valid) {
      const firstError = Object.values(errors)[0];
      if (firstError) showError(firstError);
      return;
    }

    if ([2, 3, 4, 5].includes(step)) {
      const isContainerIncomplete = (cp: ContainerProduct, s: number) => {
        if (s === 2) {
          return !((cp.quantityMt ?? 0) > 0 && !!cp.destinationPortId && !!cp.expectedShipmentDate);
        }
        if (s === 3) {
          return !containerStepComplete(cp, 'product');
        }
        if (s === 4) {
          return !containerStepComplete(cp, 'commercial');
        }
        if (s === 5) {
          return !containerStepComplete(cp, 'packaging');
        }
        return false;
      };

      let nextIncompleteIdx = -1;
      for (let i = 0; i < containerProducts.length; i++) {
        if (isContainerIncomplete(containerProducts[i], step)) {
          nextIncompleteIdx = i;
          break;
        }
      }

      if (nextIncompleteIdx !== -1) {
        if (nextIncompleteIdx !== activeContainerIdx) {
          setActiveContainerIdx(nextIncompleteIdx);
          showInfo(`Switched to Container ${nextIncompleteIdx + 1} to fill remaining details.`);
          return;
        } else {
          showError(`Please fill the details for Container ${activeContainerIdx + 1} first.`);
          return;
        }
      }
    }

    setFieldErrors({});
    setActiveContainerIdx(0);
    setStep(step + 1);
  }

  const allocatedSum = useMemo(
    () => containerProducts.reduce((s, c) => s + (c.quantityMt ?? 0), 0),
    [containerProducts],
  );

  const canAutosave = Boolean(form.buyerId && form.officeId && containerProducts[0]?.productId);

  const saveDraftPayload = useCallback(async () => {
    if (!canAutosave || isSavingDraftRef.current) return;
    isSavingDraftRef.current = true;
    const containerPayload = buildContainerProductsPayload(containerProducts, form.totalMt);
    const payload = { ...form, status: 'DRAFT', containerProducts: containerPayload, numberOfContainers: containers };
    try {
      const existingId = draftContractIdRef.current;
      if (existingId) {
        await api.updateContract(existingId, payload);
      } else {
        const created = await api.submitContract({ contract: payload, pendingMasters });
        draftContractIdRef.current = created.id;
        setDraftContractId(created.id);
      }
      invalidateQueryCache('contracts');
    } catch (e) {
      showError(e, 'Failed to save draft');
      throw e;
    } finally {
      isSavingDraftRef.current = false;
    }
  }, [form, containerProducts, containers, canAutosave, pendingMasters]);

  const { status: autosaveStatus } = useAutosave(
    { form, containerProducts },
    saveDraftPayload,
    { enabled: canAutosave },
  );

  function buildPackingDescription() {
    if (form.packingDescription) return form.packingDescription;
    if (form.packingSizeValue && form.packingSizeUnit) {
      const mat = mergedPackaging.find((p) => p.id === form.packagingTypeId)?.name || 'PACKING';
      const unit = form.packingSizeUnit === 'OTHERS' ? (form.packingSizeUnitCustom || 'UNIT') : form.packingSizeUnit;
      return `${mat.toUpperCase()} OF ${form.packingSizeValue} ${unit} NET`;
    }
    const preset = mergedPackaging.flatMap((p) => p.sizes || []).find((s) => s.id === form.packagingSizeId);
    return preset?.label;
  }

  async function handleSubmit(finalStatus = 'UNDER_PREPARATION') {
    const requireAll = finalStatus !== 'DRAFT';
    if (requireAll) {
      for (let s = 0; s <= 5; s++) {
        const { valid, errors } = validateStep(s, form, containerProducts, form.totalMt, { requireAll: true });
        if (!valid) {
          setFieldErrors(errors);
          setStep(s);
          showError('Please complete all required fields before submitting');
          return;
        }
      }
    }
    setLoading(true);
    try {
      const {
        buyerAddress,
        buyerContactPerson,
        buyerEmail,
        buyerPhone,
        buyerCode,
        buyerCountryId,
        shipmentMonthYear,
        useCustomPackingSize,
        packingSizeUnitCustom,
        ...contractData
      } = form;
      const primary = containerProducts[0];
      const containerPayload = buildContainerProductsPayload(containerProducts, form.totalMt);

      const contractPayload = {
        ...contractData,
        status: finalStatus,
        productId: primary.productId,
        productVariantId: primary.productVariantId,
        processingType: primary.processingType,
        specification: primary.specification,
        productRemarks: primary.productRemarks,
        destinationPortId: primary.destinationPortId,
        expectedShipmentDate: primary.expectedShipmentDate,
        shipmentHalf: primary.shipmentHalf,
        containerNo: primary.containerNo,
        incoterm: primary.incoterm ?? contractData.incoterm,
        fobPrice: primary.fobPrice ?? contractData.fobPrice,
        fobCurrency: primary.fobCurrency ?? contractData.fobCurrency,
        exchangeRate: primary.exchangeRate ?? contractData.exchangeRate,
        freight: primary.totalFreight ?? contractData.freight,
        insurance: primary.insurance ?? contractData.insurance,
        containerProducts: containerPayload,
        quantityUnit: 'MT',
        fobPriceUnit: 'PER_MT',
        numberOfContainers: containers,
        shipmentMonth: primary.shipmentMonthYear ? formatShipmentMonthDb(primary.shipmentMonthYear) : undefined,
        shipmentYear: primary.shipmentMonthYear ? Number(primary.shipmentMonthYear.split('-')[0]) : undefined,
        packingDescription: containerProducts[0]?.packingDescription ?? buildPackingDescription(),
        cifPrice: primary.cifPrice ?? (form.cifManualOverride ? form.cifPrice : undefined),
        originalContractPrice: form.originalContractPrice ?? primary.fobPrice ?? form.fobPrice,
      };

      const buyerUpdate = form.buyerId
        ? {
            address: buyerAddress,
            contactPerson: buyerContactPerson,
            email: buyerEmail,
            phone: buyerPhone,
            euClassification: form.euClassification || undefined,
            code: buyerCode?.trim() || undefined,
            countryId: buyerCountryId || undefined,
          }
        : undefined;

      const created = draftContractIdRef.current
        ? await api.updateContract(draftContractIdRef.current, contractPayload)
        : await api.submitContract({
            contract: contractPayload,
            pendingMasters: hasPendingMasters(pendingMasters) ? pendingMasters : undefined,
            buyerUpdate,
          });
      if (!draftContractIdRef.current) {
        draftContractIdRef.current = created.id;
        setDraftContractId(created.id);
      }
      invalidateQueryCache('dashboard');
      invalidateQueryCache('contracts');
      invalidateQueryCache('masters:offices');
      invalidateQueryCache('masters:salespersons');
      invalidateQueryCache('masters:buyers');
      invalidateQueryCache('masters:products');
      invalidateQueryCache('masters:packaging');
      invalidateQueryCache('masters:countries');
      if (finalStatus === 'DRAFT') {
        showSuccess(`Draft saved. Contract Number: ${created.contractNumber}`);
      } else {
        showSuccess(
          `Contract submitted successfully.\nContract Number: ${created.contractNumber}\nThe contract has been saved and the respective departments have been notified.\nTotal Containers Created: ${created.numberOfContainers ?? containers}\nProduction Unit Assignment: Pending`,
        );
      }
      const successQuery = finalStatus === 'DRAFT' ? 'draft=1' : 'created=1';
      router.push(`/contracts/${created.id}?${successQuery}`);
    } catch (e) {
      showError(e, 'Failed to save contract');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (userRole === null) {
    return (
      <AppShell title="New Contract">
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-slate-500">Checking permissions…</p>
        </div>
      </AppShell>
    );
  }

  if (!['SUPER_ADMIN', 'OFFICE_ADMIN', 'CONTRACT_TEAM', 'SUPER_SALES'].includes(userRole)) {
    return (
      <AppShell title="Access Denied">
        <div className="ems-card p-5 text-center text-red-500 font-semibold flex flex-col items-center justify-center gap-3">
          <ShieldAlert className="h-10 w-10 text-rose-500" />
          <p>Access Denied. You do not have permission to create contracts.</p>
          <Link href="/dashboard" className="ems-btn-primary text-xs mt-2">
            Back to Dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="New Contract" subtitle="Create a new export contract">
      <div className="mb-2 flex justify-end">
        <AutosaveIndicator status={autosaveStatus} />
      </div>
      <StepPills steps={STEPS} current={step} onStepClick={goToStep} />

      <div className="ems-card max-w-5xl overflow-visible p-6">
        {/* SECTION A */}
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
              <Field label="Office">
                <EmsSelect
                  value={form.officeId}
                  onChange={(v) => setField('officeId', v)}
                  placeholder="Select office"
                  addOptionValue={ADD_OPTION_VALUE}
                  onAddSelect={() => setAddPanel('office')}
                  options={[
                    { value: '', label: 'Select office' },
                    ...mergedOffices.map((o) => ({ value: o.id, label: o.name })),
                    { value: ADD_OPTION_VALUE, label: '+ Add other office name' },
                  ]}
                />
                <FieldError message={fieldErrors.officeId} />
                {addPanel === 'office' && (
                  <InlineAddPanel
                    title="Add office"
                    fields={[{ key: 'name', label: 'Office name', placeholder: 'Office name' }]}
                    onCancel={() => setAddPanel(null)}
                    onSave={async (values) => {
                      const { pending, office } = addPendingOffice(pendingMasters, values.name);
                      setPendingMasters(pending);
                      setField('officeId', office.id);
                      setAddPanel(null);
                    }}
                  />
                )}
              </Field>
              <Field label="Salesperson Responsible" className="sm:col-span-2">
                <p className="mb-2 text-xs text-slate-500">
                  Select one or more salespeople credited for bringing this contract (separate from Created By).
                </p>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  {mergedSalespersons.map((s) => {
                    const selected = (form.salespersonIds || []).includes(s.id) || form.salespersonId === s.id;
                    return (
                      <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={!!selected}
                          onChange={(e) => {
                            const current = new Set(form.salespersonIds?.length ? form.salespersonIds : form.salespersonId ? [form.salespersonId] : []);
                            if (e.target.checked) current.add(s.id);
                            else current.delete(s.id);
                            const ids = [...current];
                            setForm((f) => ({ ...f, salespersonIds: ids, salespersonId: ids[0] || '' }));
                          }}
                        />
                        {s.name}
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-blue-600 hover:underline"
                  onClick={() => setAddPanel('salesperson')}
                >
                  + Add Salesperson...
                </button>
                {addPanel === 'salesperson' && (
                  <InlineAddPanel
                    title="Add salesperson"
                    fields={[{ key: 'name', label: 'Salesperson name', placeholder: 'Full name' }]}
                    onCancel={() => setAddPanel(null)}
                    onSave={async (values) => {
                      const { pending, sp } = addPendingSalesperson(pendingMasters, values.name);
                      setPendingMasters(pending);
                      setForm((f) => {
                        const ids = [...(f.salespersonIds || []), sp.id];
                        return { ...f, salespersonIds: ids, salespersonId: ids[0] };
                      });
                      setAddPanel(null);
                    }}
                  />
                )}
              </Field>
            </div>
            <Field label={BASIC_DATE_LABELS.contractSentDate}>
              <input type="date" className="ems-input" value={form.contractSentDate || ''} onChange={(e) => setField('contractSentDate', e.target.value)} />
              <FieldError message={fieldErrors.contractSentDate} />
            </Field>
            <Field label={BASIC_DATE_LABELS.contractDate}>
              <input type="date" className="ems-input" value={form.contractDate || ''} onChange={(e) => setField('contractDate', e.target.value)} />
              <FieldError message={fieldErrors.contractDate} />
            </Field>
            <Field label="Contract Number" hint="Auto: CONT/2026/0001 if blank">
              <input className="ems-input" placeholder="e.g. 05610 or CONT/2026/0010" value={form.contractNumber || ''} onChange={(e) => setField('contractNumber', e.target.value)} />
            </Field>
            <Field label={BASIC_DATE_LABELS.receivedDate}>
              <input type="date" className="ems-input" value={form.receivedDate || ''} onChange={(e) => setField('receivedDate', e.target.value)} />
              <FieldError message={fieldErrors.receivedDate} />
            </Field>
            <Field label={BASIC_DATE_LABELS.signedContractReceivedDate}>
              <input type="date" className="ems-input" value={form.signedContractReceivedDate || ''} onChange={(e) => setField('signedContractReceivedDate', e.target.value)} />
              <FieldError message={fieldErrors.signedContractReceivedDate} />
            </Field>
            <Field label="Invoice Number (dispatch stage)">
              <input className="ems-input" value={form.invoiceNumber || ''} onChange={(e) => setField('invoiceNumber', e.target.value)} />
            </Field>
            <Field label="Contract Status">
              <EmsSelect
                value={form.status || 'DRAFT'}
                onChange={(v) => setField('status', v)}
                options={CONTRACT_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
              />
            </Field>
            <Field label="Remarks" className="sm:col-span-2">
              <textarea className="ems-input min-h-[72px]" value={form.remarks || ''} onChange={(e) => setField('remarks', e.target.value)} />
            </Field>
            <Field label="Internal Remarks (authorized users only)" className="sm:col-span-2">
              <textarea className="ems-input min-h-[72px]" value={form.internalRemarks || ''} onChange={(e) => setField('internalRemarks', e.target.value)} />
            </Field>
          </div>
        )}

        {/* SECTION B */}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Buyer Name" className="sm:col-span-2">
              <EmsSelect
                searchable
                value={form.buyerId}
                onChange={onBuyerChange}
                placeholder="Select buyer"
                addOptionValue={ADD_OPTION_VALUE}
                onAddSelect={() => setShowBuyerModal(true)}
                options={[
                  { value: '', label: 'Select buyer' },
                  ...mergedBuyers.map((b) => ({
                    value: b.id,
                    label: b.code ? `${b.name} (${b.code})` : b.name,
                  })),
                  { value: ADD_OPTION_VALUE, label: '+ Add buyer name' },
                ]}
              />
              {(addPanel === 'buyer' || addPanel === 'country-new-buyer') && (
                <div className="mt-2 space-y-2">
                  <Field label="Country">
                    <EmsSelect
                      searchable
                      value={newBuyerCountryId || mergedCountries[0]?.id || ''}
                      onChange={setNewBuyerCountryId}
                      placeholder="Select country"
                      addOptionValue={ADD_OPTION_VALUE}
                      onAddSelect={() => setAddPanel('country-new-buyer')}
                      options={[
                        ...mergedCountries.map((c) => ({ value: c.id, label: c.name })),
                        { value: ADD_OPTION_VALUE, label: '+ Add other country' },
                      ]}
                    />
                  </Field>
                  {addPanel === 'country-new-buyer' && (
                    <div className="space-y-2">
                      <Field label="EU / Non-EU">
                        <EmsSelect
                          value={newCountryEu}
                          onChange={setNewCountryEu}
                          options={[
                            { value: 'EU', label: 'EU' },
                            { value: 'NON_EU', label: 'Non-EU' },
                          ]}
                        />
                      </Field>
                      <InlineAddPanel
                        title="Add country"
                        fields={[{ key: 'name', label: 'Country name', placeholder: 'e.g. Vietnam' }]}
                        onCancel={() => setAddPanel('buyer')}
                        onSave={async (values) => {
                          const country = addLocalCountry(values.name, newCountryEu);
                          setNewBuyerCountryId(country.id);
                          setAddPanel('buyer');
                        }}
                      />
                    </div>
                  )}
                  {addPanel !== 'country-new-buyer' && (
                  <InlineAddPanel
                    title="Add buyer"
                    fields={[{ key: 'name', label: 'Buyer name', placeholder: 'Enter buyer name' }]}
                    onCancel={() => setAddPanel(null)}
                    onSave={async (values) => {
                      const existing = findExistingBuyerByName(mergedBuyers, values.name);
                      if (existing) {
                        showInfo(`Buyer "${existing.name}" already exists — selected existing record (${existing.code || 'no code'})`);
                        onBuyerChange(existing.id);
                        setAddPanel(null);
                        return;
                      }
                      const countryId = newBuyerCountryId || mergedCountries[0]?.id;
                      if (!countryId) throw new Error('No country');
                      const { pending, buyer } = addPendingBuyer(pendingMasters, values.name, countryId, mergedCountries);
                      setPendingMasters(pending);
                      onBuyerChange(buyer.id);
                      setAddPanel(null);
                    }}
                  />
                  )}
                </div>
              )}
            </Field>
            <Field label="Buyer Code">
              <input
                className="ems-input"
                value={form.buyerCode || ''}
                onChange={(e) => setField('buyerCode', e.target.value)}
                placeholder="Buyer code"
                disabled={!form.buyerId}
              />
            </Field>
            <Field label="Country Name">
              <EmsSelect
                searchable
                value={form.buyerCountryId || ''}
                onChange={onBuyerCountryChange}
                placeholder="Select country"
                disabled={!form.buyerId}
                addOptionValue={ADD_OPTION_VALUE}
                onAddSelect={() => setAddPanel('country')}
                options={countryOptions}
              />
              {addPanel === 'country' && form.buyerId && (
                <div className="mt-2 space-y-2">
                  <Field label="EU / Non-EU">
                    <EmsSelect
                      value={newCountryEu}
                      onChange={setNewCountryEu}
                      options={[
                        { value: 'EU', label: 'EU' },
                        { value: 'NON_EU', label: 'Non-EU' },
                      ]}
                    />
                  </Field>
                  <InlineAddPanel
                    title="Add country"
                    fields={[{ key: 'name', label: 'Country name', placeholder: 'e.g. Vietnam' }]}
                    onCancel={() => setAddPanel(null)}
                    onSave={async (values) => {
                      const country = addLocalCountry(values.name, newCountryEu);
                      onBuyerCountryChange(country.id);
                      setAddPanel(null);
                    }}
                  />
                </div>
              )}
            </Field>
            <Field label="EU / Non-EU">
              <EmsSelect
                value={form.euClassification || selectedBuyer?.euClassification || selectedBuyer?.country?.euClassification || ''}
                onChange={(v) => setField('euClassification', v)}
                placeholder="Auto from buyer"
                options={[
                  { value: '', label: 'Auto from buyer' },
                  { value: 'EU', label: 'EU' },
                  { value: 'NON_EU', label: 'Non-EU' },
                ]}
              />
            </Field>
            <Field label="Buyer Address" className="sm:col-span-2">
              <textarea
                className="ems-input min-h-[72px]"
                value={form.buyerAddress || ''}
                onChange={(e) => setField('buyerAddress', e.target.value)}
                placeholder="Enter buyer address"
              />
            </Field>
            <Field label="Contact Person">
              <input
                className="ems-input"
                value={form.buyerContactPerson || ''}
                onChange={(e) => setField('buyerContactPerson', e.target.value)}
                placeholder="Contact person name"
              />
            </Field>
            <Field label="Buyer Email">
              <input
                type="email"
                className="ems-input"
                value={form.buyerEmail || ''}
                onChange={(e) => setField('buyerEmail', e.target.value)}
                placeholder="buyer@company.com"
              />
            </Field>
            <Field label="Buyer Phone">
              <input
                className="ems-input"
                value={form.buyerPhone || ''}
                onChange={(e) => setField('buyerPhone', e.target.value)}
                placeholder="+30 ..."
              />
            </Field>
            <Field label="Buyer Remarks" className="sm:col-span-2">
              <textarea className="ems-input min-h-[72px]" value={form.buyerRemarks || ''} onChange={(e) => setField('buyerRemarks', e.target.value)} placeholder="Optional buyer-related instructions" />
            </Field>
          </div>
        )}

        {/* Quantity */}
        {step === 2 && (
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Total MT">
                <input
                  type="number"
                  step="0.001"
                  className="ems-input"
                  value={form.totalMt}
                  onChange={(e) => setField('totalMt', parseFloat(e.target.value))}
                />
              </Field>
              <Field label="No. of Containers">
                <input
                  type="number"
                  min={1}
                  className="ems-input"
                  value={containers}
                  onChange={(e) => setField('numberOfContainers', parseInt(e.target.value, 10) || 1)}
                />
              </Field>
            </div>
            <p className={`mb-2 text-sm ${Math.abs(allocatedSum - form.totalMt) < 0.001 ? 'text-green-700' : 'text-red-600'}`}>
              Allocated: {allocatedSum.toFixed(3)} MT / Contract total: {form.totalMt} MT
            </p>
            <FieldError message={fieldErrors.quantityMt || fieldErrors.totalMt} />

            <ContainerTabs
              active={activeContainerIdx}
              onChange={setActiveContainerIdx}
              tabs={containerProducts.map((cp, i) => ({
                index: i,
                label: `Container ${i + 1}`,
                complete: (cp.quantityMt ?? 0) > 0 && !!cp.destinationPortId,
              }))}
            />
            {containerProducts.map((cp, idx) =>
              idx === activeContainerIdx ? (
              <ContainerShipmentSection
                key={idx}
                index={idx}
                data={cp}
                ports={masters.ports}
                showCopyButton={idx > 0}
                onCopyFromFirst={() => copyContainerShipmentFromPrevious(idx)}
                onPatch={(patch) => patchContainerProduct(idx, patch)}
                errors={fieldErrors}
                onAddPort={() => {
                  setPortModalIndex(idx);
                  setShowPortModal(true);
                }}
                hideBorder={true}
              />
              ) : null,
            )}
            <div className="mt-4 flex justify-between">
              <button
                type="button"
                className="ems-btn-secondary gap-1"
                disabled={activeContainerIdx === 0}
                onClick={() => setActiveContainerIdx((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous Container
              </button>
              <button
                type="button"
                className="ems-btn-secondary gap-1"
                disabled={activeContainerIdx >= containerProducts.length - 1}
                onClick={() => setActiveContainerIdx((i) => Math.min(containerProducts.length - 1, i + 1))}
              >
                Next Container <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Product — one form per container */}
        {step === 3 && (
          <div>
            <ContainerTabs
              active={activeContainerIdx}
              onChange={setActiveContainerIdx}
              tabs={containerProducts.map((cp, i) => ({
                index: i,
                label: `Container ${i + 1}`,
                complete: containerStepComplete(cp, 'product'),
              }))}
            />
            {containerProducts.map((cp, idx) =>
              idx === activeContainerIdx ? (
              <ContainerProductSection
                key={idx}
                index={idx}
                data={cp}
                products={mergedProducts}
                showCopyButton={idx > 0}
                onCopyFromFirst={() => copyContainerFromPrevious(idx)}
                onChange={(field, value) => updateContainerProduct(idx, field, value)}
                onPatch={(patch) => patchContainerProduct(idx, patch)}
                addPanel={productAdd?.containerIndex === idx ? productAdd.panel : null}
                isAddTarget={productAdd?.containerIndex === idx}
                onOpenAddProduct={() => setProductAdd({ panel: 'product', containerIndex: idx })}
                onOpenAddVariant={() => setProductAdd({ panel: 'variant', containerIndex: idx })}
                onCloseAddPanel={() => setProductAdd(null)}
                onProductCreated={(product) => {
                  patchContainerProduct(idx, {
                    productId: product.id,
                    specification: product.defaultSpecification || '',
                  });
                }}
                createProduct={async (name) => {
                  const { pending, product } = addPendingProduct(pendingMasters, name);
                  setPendingMasters(pending);
                  return product;
                }}
                createVariant={async (productId, name, processingType) => {
                  const { pending, product } = addPendingProductVariant(
                    pendingMasters,
                    productId,
                    name,
                    processingType,
                    mergedProducts,
                  );
                  setPendingMasters(pending);
                  return product;
                }}
                onVariantCreated={(product, variantName) => {
                  const variant = product.variants?.find((v) => v.name === variantName);
                  if (variant) {
                    patchContainerProduct(idx, {
                      productVariantId: variant.id,
                      processingType: variant.processingType || variant.name,
                    });
                  }
                }}
                hideBorder={true}
                errors={fieldErrors}
              />
              ) : null,
            )}
            <div className="mt-4 flex justify-between">
              <button
                type="button"
                className="ems-btn-secondary gap-1"
                disabled={activeContainerIdx === 0}
                onClick={() => setActiveContainerIdx((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous Container
              </button>
              <button
                type="button"
                className="ems-btn-secondary gap-1"
                disabled={activeContainerIdx >= containerProducts.length - 1}
                onClick={() => setActiveContainerIdx((i) => Math.min(containerProducts.length - 1, i + 1))}
              >
                Next Container <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Commercial — per container */}
        {step === 4 && (
          <div className="space-y-4">
            <ContainerTabs
              active={activeContainerIdx}
              onChange={setActiveContainerIdx}
              tabs={containerProducts.map((cp, i) => ({
                index: i,
                label: `Container ${i + 1}`,
                complete: containerStepComplete(cp, 'commercial'),
              }))}
            />
            {containerProducts.map((cp, idx) =>
              idx === activeContainerIdx ? (
              <ContainerCommercialSection
                key={idx}
                container={{
                  ...cp,
                  containerIndex: idx + 1,
                  quantityMt: cp.quantityMt ?? form.totalMt / containers,
                }}
                onChange={(patch) => {
                  if (patch.fobCurrency !== undefined) {
                    refreshExchangeRate(idx, patch.fobCurrency);
                  } else {
                    patchContainerProduct(idx, patch);
                  }
                }}
                onRefreshRate={() => refreshExchangeRate(idx)}
                isRefreshing={refreshingIdx === idx}
                showCopyButton={idx > 0}
                onCopyFromFirst={() => copyContainerCommercialFromPrevious(idx)}
              />
              ) : null,
            )}
            <div className="mt-4 flex justify-between">
              <button
                type="button"
                className="ems-btn-secondary gap-1"
                disabled={activeContainerIdx === 0}
                onClick={() => setActiveContainerIdx((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous Container
              </button>
              <button
                type="button"
                className="ems-btn-secondary gap-1"
                disabled={activeContainerIdx >= containerProducts.length - 1}
                onClick={() => setActiveContainerIdx((i) => Math.min(containerProducts.length - 1, i + 1))}
              >
                Next Container <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Packaging & Payment */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 font-semibold text-slate-800">Container Packaging</h3>
              <ContainerTabs
                active={activeContainerIdx}
                onChange={setActiveContainerIdx}
                tabs={containerProducts.map((cp, i) => ({
                  index: i,
                  label: `Container ${i + 1}`,
                  complete: containerStepComplete(cp, 'packaging'),
                }))}
              />
              {containerProducts.map((cp, idx) =>
                idx === activeContainerIdx ? (
                <ContainerPackagingSection
                  key={idx}
                  index={idx}
                  data={cp}
                  packaging={mergedPackaging}
                  showCopyButton={idx > 0}
                  onCopyFromFirst={() => patchContainerProduct(idx, {
                    packagingTypeId: containerProducts[0].packagingTypeId,
                    packagingSizeId: containerProducts[0].packagingSizeId,
                    packingDescription: containerProducts[0].packingDescription,
                    packingSizeValue: containerProducts[0].packingSizeValue,
                    packingSizeUnit: containerProducts[0].packingSizeUnit,
                  })}
                  onPatch={(patch) => patchContainerProduct(idx, patch)}
                  onAddPackaging={() => setAddPanel('packaging')}
                  hideBorder={true}
                />
                ) : null,
              )}
              <div className="mt-4 flex justify-between">
                <button
                  type="button"
                  className="ems-btn-secondary gap-1"
                  disabled={activeContainerIdx === 0}
                  onClick={() => setActiveContainerIdx((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous Container
                </button>
                <button
                  type="button"
                  className="ems-btn-secondary gap-1"
                  disabled={activeContainerIdx >= containerProducts.length - 1}
                  onClick={() => setActiveContainerIdx((i) => Math.min(containerProducts.length - 1, i + 1))}
                >
                  Next Container <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {addPanel === 'packaging' && (
                <InlineAddPanel
                  title="Add packaging material"
                  fields={[{ key: 'name', label: 'Material name', placeholder: 'e.g. PP' }]}
                  onCancel={() => setAddPanel(null)}
                  onSave={async (values) => {
                    const { pending, pkg } = addPendingPackagingType(pendingMasters, values.name);
                    setPendingMasters(pending);
                    patchContainerProduct(activeContainerIdx, { packagingTypeId: pkg.id });
                    setAddPanel(null);
                  }}
                />
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 border-t border-slate-200 pt-6">
            <Field label="Payment Term">
              <EmsSelect
                value={form.paymentType || ''}
                onChange={(v) => setField('paymentType', v)}
                options={[
                  { value: 'ADVANCE', label: 'Advance + Balance' },
                  { value: 'CAD', label: 'CAD' },
                  { value: 'DIRECT', label: 'Direct' },
                  { value: 'OTHERS', label: 'Others' },
                ]}
              />
              <FieldError message={fieldErrors.paymentType} />
            </Field>
            {(form.paymentType === 'OTHERS' || form.balancePaymentMode === 'OTHERS') && (
              <Field label="Specify Other Payment Method *" className="sm:col-span-2">
                <input
                  className="ems-input"
                  value={form.otherPaymentMethod || ''}
                  onChange={(e) => setField('otherPaymentMethod', e.target.value)}
                  placeholder="e.g. Bank Transfer after document approval"
                />
                <FieldError message={fieldErrors.otherPaymentMethod} />
              </Field>
            )}
            {form.paymentType === 'ADVANCE' && (
              <>
                <Field label="Advance %">
                  <input type="number" className="ems-input" value={form.advancePercentage ?? 10} onChange={(e) => setField('advancePercentage', parseFloat(e.target.value))} />
                </Field>
                <Field label="Remaining Payment Balance Method">
                  <EmsSelect
                    value={form.balancePaymentMode || ''}
                    onChange={(v) => setField('balancePaymentMode', v)}
                    placeholder="Select method"
                    options={[
                      { value: '', label: 'Select method' },
                      ...BALANCE_PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })),
                    ]}
                  />
                </Field>
                {form.balancePaymentMode === 'OTHERS' && !form.otherPaymentMethod && (
                  <Field label="Other payment method" className="sm:col-span-2">
                    <input
                      className="ems-input"
                      value={form.balancePaymentStage || ''}
                      onChange={(e) => setField('balancePaymentStage', e.target.value)}
                      placeholder="Describe other payment method"
                    />
                  </Field>
                )}
              </>
            )}
          </div>
          </div>
        )}

        {/* Review */}
        {step === 6 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Review before save</h3>
              <p className="mt-1 text-sm text-slate-500">Check all details below before submitting the contract.</p>
            </div>

            <ReviewSection title="Section A — Basic">
              <ReviewField label="Office" value={mergedOffices.find((o) => o.id === form.officeId)?.name} />
              <ReviewField label="Salesperson" value={mergedSalespersons.find((s) => s.id === form.salespersonId)?.name} />
              <ReviewField label="Contract No." value={form.contractNumber || 'Auto-generated'} />
              <ReviewField label="Status" value={CONTRACT_STATUSES.find((s) => s.value === form.status)?.label ?? form.status} />
              <ReviewField label="Contract Date" value={form.contractDate} />
            </ReviewSection>

            <ReviewSection title="Section B — Buyer">
              <ReviewField label="Buyer" value={selectedBuyer?.name} />
              <ReviewField label="Buyer Code" value={form.buyerCode || selectedBuyer?.code} />
              <ReviewField
                label="Country"
                value={mergedCountries.find((c) => c.id === form.buyerCountryId)?.name || selectedBuyer?.country?.name}
              />
              <ReviewField label="EU / Non-EU" value={form.euClassification || selectedBuyer?.country?.euClassification} />
              <ReviewField label="Contact Person" value={form.buyerContactPerson} />
              <ReviewField label="Address" value={form.buyerAddress} className="sm:col-span-2" />
              <ReviewField label="Email" value={form.buyerEmail} />
              <ReviewField label="Phone" value={form.buyerPhone} />
            </ReviewSection>

            <ReviewSection title="Quantity & Shipment">
              <ReviewField label="Total Quantity" value={`${form.totalMt} MT`} />
              <ReviewField label="No. of Containers" value={containers} />
              {containerProducts.map((cp, idx) => {
                const periodLabel =
                  cp.shipmentMonthYear && cp.shipmentHalf
                    ? formatShipmentPeriodLabel(cp.shipmentMonthYear, cp.shipmentHalf)
                    : undefined;
                return (
                  <div
                    key={idx}
                    className={`grid gap-3 sm:col-span-2 sm:grid-cols-2 ${idx > 0 ? 'mt-2 border-t border-slate-100 pt-4' : ''}`}
                  >
                    {containers > 1 && (
                      <p className="text-sm font-semibold text-slate-700 sm:col-span-2">Container {idx + 1}</p>
                    )}
                    <ReviewField
                      label="Destination Port"
                      value={masters.ports.find((p) => p.id === cp.destinationPortId)?.name}
                    />
                    <ReviewField label="Shipment Period" value={periodLabel} />
                    <ReviewField label="Expected Shipment" value={cp.expectedShipmentDate} />
                    <ReviewField label="Container No." value={cp.containerNo} />
                  </div>
                );
              })}
            </ReviewSection>

            <ReviewSection title="Product">
              {containerProducts.map((cp, idx) => {
                const product = mergedProducts.find((p) => p.id === cp.productId);
                return (
                  <div key={idx} className={`grid gap-3 sm:col-span-2 sm:grid-cols-2 ${idx > 0 ? 'mt-2 border-t border-slate-100 pt-4' : ''}`}>
                    {containers > 1 && (
                      <p className="text-sm font-semibold text-slate-700 sm:col-span-2">Container {idx + 1}</p>
                    )}
                    <ReviewField label="Product" value={product ? `${product.code} — ${product.name}` : undefined} />
                    <ReviewField
                      label="Variant"
                      value={product?.variants?.find((v) => v.id === cp.productVariantId)?.name}
                    />
                    <ReviewField label="Processing" value={cp.processingType} />
                    <ReviewField label="Specification" value={cp.specification} className="sm:col-span-2" />
                  </div>
                );
              })}
            </ReviewSection>

            <ReviewSection title="Section D — Commercial">
              {containerProducts.map((cp, idx) => {
                const calc = enrichContainerCommercial({
                  incoterm: cp.incoterm ?? 'FOB',
                  fobPrice: cp.fobPrice,
                  exchangeRate: cp.exchangeRate,
                  quantityMt: form.totalMt / containers,
                  totalFreight: cp.totalFreight,
                  insurance: cp.insurance,
                });
                return (
                  <div key={idx} className={`grid gap-3 sm:col-span-2 sm:grid-cols-2 ${idx > 0 ? 'mt-2 border-t border-slate-100 pt-4' : ''}`}>
                    {containers > 1 && (
                      <p className="text-sm font-semibold text-slate-700 sm:col-span-2">Container {idx + 1}</p>
                    )}
                    <ReviewField label="Incoterm" value={cp.incoterm ?? 'FOB'} />
                    <ReviewField label="FOB Price" value={cp.fobPrice != null ? `${cp.fobPrice} ${cp.fobCurrency || 'USD'}` : undefined} />
                    <ReviewField label="Exchange Rate" value={cp.exchangeRate} />
                    <ReviewField label="FOB INR / Kg" value={calc.fobInrPerKg?.toFixed(2)} />
                    <ReviewField label="Total Freight" value={cp.totalFreight} />
                    <ReviewField label="Freight per MT" value={calc.freightPerMt?.toFixed(2)} />
                    <ReviewField label="Insurance" value={cp.insurance} />
                    <ReviewField label="CIF Price" value={calc.cifPrice?.toFixed(2)} />
                    <ReviewField label="CNF Price" value={calc.cnfPrice?.toFixed(2)} />
                  </div>
                );
              })}
            </ReviewSection>

            <ReviewSection title="Packaging & Payment">
              {containerProducts.map((cp, idx) => {
                const pkgMaterial = mergedPackaging.find((p) => p.id === cp.packagingTypeId)?.name;
                const pkgSize = cp.packingDescription || mergedPackaging.flatMap((p) => p.sizes || []).find((s) => s.id === cp.packagingSizeId)?.label;
                return (
                  <div key={idx} className={`grid gap-3 sm:col-span-2 sm:grid-cols-2 ${idx > 0 ? 'mt-2 border-t border-slate-100 pt-4' : ''}`}>
                    {containers > 1 && (
                      <p className="text-sm font-semibold text-slate-700 sm:col-span-2">Container {idx + 1}</p>
                    )}
                    <ReviewField label="Packing Material" value={pkgMaterial} />
                    <ReviewField label="Packing Size" value={pkgSize} />
                  </div>
                );
              })}
              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 mt-4 border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-700 sm:col-span-2">Payment Details</p>
                <ReviewField
                  label="Payment Term"
                  value={
                    form.paymentType === 'ADVANCE'
                      ? `Advance ${form.advancePercentage ?? 10}% — ${BALANCE_PAYMENT_METHODS.find((m) => m.value === form.balancePaymentMode)?.label || form.balancePaymentMode || ''}${form.balancePaymentMode === 'OTHERS' && form.balancePaymentStage ? `: ${form.balancePaymentStage}` : ''}`
                      : form.paymentType === 'CAD'
                        ? 'CAD'
                        : form.paymentType === 'DIRECT'
                          ? 'Direct'
                          : form.paymentType === 'OTHERS'
                            ? 'Others'
                            : form.paymentType
                  }
                />
              </div>
            </ReviewSection>
          </div>
        )}

        <div className="mt-8 flex justify-between border-t border-slate-100 pt-4">
          <button type="button" disabled={step === 0} onClick={() => goToStep(step - 1)} className="ems-btn-secondary gap-1">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex gap-2">
            <button type="button" disabled={loading} onClick={() => handleSubmit('DRAFT')} className="ems-btn-secondary gap-1">
              <Save className="h-4 w-4" /> Save Draft
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={goNext} className="ems-btn-primary gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" disabled={loading || !form.buyerId || !containerProducts[0]?.productId} onClick={() => handleSubmit('UNDER_PREPARATION')} className="ems-btn-primary">
                {loading ? 'Saving...' : 'Submit Contract'}
              </button>
            )}
          </div>
        </div>
      </div>

      <AddBuyerModal
        open={showBuyerModal}
        countries={mergedCountries}
        ports={masters.ports}
        officeId={form.officeId}
        onClose={() => setShowBuyerModal(false)}
        onSaved={(buyer) => {
          setMasters((m) => ({ ...m, buyers: [...m.buyers.filter((b) => b.id !== buyer.id), buyer] }));
          applyBuyerToForm(buyer, buyer.id);
          setShowBuyerModal(false);
        }}
        onPortCreated={(port) => {
          setMasters((m) => ({ ...m, ports: [...m.ports.filter((p) => p.id !== port.id), port] }));
        }}
      />
      <AddPortModal
        open={showPortModal}
        countries={mergedCountries}
        onClose={() => setShowPortModal(false)}
        onSaved={(port) => {
          setMasters((m) => ({ ...m, ports: [...m.ports, port] }));
          patchContainerProduct(portModalIndex, { destinationPortId: port.id });
          setShowPortModal(false);
        }}
      />
    </AppShell>
  );
}
