'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/sidebar';
import { Field, ReadOnly, StepPills, CONTRACT_STATUSES, ReviewSection, ReviewField } from '@/components/contracts/form-fields';
import { ContainerProductSection } from '@/components/contracts/container-product-section';
import { ContainerShipmentSection } from '@/components/contracts/container-shipment-section';
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
import { showError, showInfo } from '@/lib/toast';
import { ADD_OPTION_VALUE, BALANCE_PAYMENT_METHODS, PACKING_SIZE_UNITS } from '@/lib/form-constants';
import {
  formatShipmentMonthDb,
  formatShipmentPeriodLabel,
} from '@/lib/shipment-period';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';

const STEPS = ['Basic Info', 'Buyer', 'Quantity', 'Product', 'Commercial', 'Packaging & Payment', 'Review'];

function emptyContainerProduct(): ContainerProduct {
  return {
    productId: '',
    productVariantId: '',
    processingType: '',
    specification: '',
    productRemarks: '',
    destinationPortId: '',
    shipmentMonthYear: '',
    shipmentHalf: undefined,
    expectedShipmentDate: '',
    containerNo: '',
  };
}

export default function NewContractPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
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
    freightUnit: 'PER_CONTAINER',
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
        officeId: assignedOffice || amd?.id || '',
      }));
    });
  }, [user.officeId]);

  const selectedBuyer = mergedBuyers.find((b) => b.id === form.buyerId);
  const fobInrPerKg = useMemo(() => {
    if (form.fobPrice && form.exchangeRate) {
      const unit = form.fobPriceUnit || 'PER_MT';
      if (unit === 'PER_MT') return ((form.fobPrice * form.exchangeRate) / 1000).toFixed(4);
      if (unit === 'PER_KG') return (form.fobPrice * form.exchangeRate).toFixed(4);
    }
    return '';
  }, [form.fobPrice, form.exchangeRate, form.fobPriceUnit]);

  const autoCif = useMemo(() => {
    if (form.fobPrice != null) return (form.fobPrice + (form.freight || 0) + (form.insurance || 0)).toFixed(2);
    return '';
  }, [form.fobPrice, form.freight, form.insurance]);

  const autoContainers = useMemo(() => Math.ceil((form.totalMt || 0) / 28), [form.totalMt]);
  const containers = form.numberOfContainers ?? autoContainers;

  useEffect(() => {
    setContainerProducts((prev) => {
      const n = Math.max(1, containers);
      if (prev.length === n) return prev;
      if (prev.length < n) {
        return [...prev, ...Array.from({ length: n - prev.length }, () => emptyContainerProduct())];
      }
      return prev.slice(0, n);
    });
  }, [containers]);

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

  function copyContainerFromFirst(targetIndex: number) {
    setContainerProducts((prev) => {
      const next = [...prev];
      next[targetIndex] = { ...prev[0] };
      return next;
    });
  }

  function copyContainerShipmentFromFirst(targetIndex: number) {
    setContainerProducts((prev) => {
      const next = [...prev];
      const first = prev[0];
      next[targetIndex] = {
        ...next[targetIndex],
        destinationPortId: first.destinationPortId,
        shipmentMonthYear: first.shipmentMonthYear,
        shipmentHalf: first.shipmentHalf,
        expectedShipmentDate: first.expectedShipmentDate,
        containerNo: first.containerNo,
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

  function onBuyerChange(buyerId: string) {
    const buyer = mergedBuyers.find((b) => b.id === buyerId);
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
  }

  function goNext() {
    setStep(step + 1);
  }

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
      const perContainerMt = form.totalMt / containers;

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
        containerProducts: containerProducts.map((c, i) => ({
          containerIndex: i + 1,
          productId: c.productId,
          productVariantId: c.productVariantId || undefined,
          processingType: c.processingType || undefined,
          specification: c.specification || undefined,
          productRemarks: c.productRemarks || undefined,
          quantityMt: perContainerMt,
          destinationPortId: c.destinationPortId || undefined,
          expectedShipmentDate: c.expectedShipmentDate || undefined,
          shipmentMonth: c.shipmentMonthYear ? formatShipmentMonthDb(c.shipmentMonthYear) : undefined,
          shipmentYear: c.shipmentMonthYear ? Number(c.shipmentMonthYear.split('-')[0]) : undefined,
          shipmentHalf: c.shipmentHalf || undefined,
          containerNo: c.containerNo || undefined,
        })),
        quantityUnit: 'MT',
        fobPriceUnit: 'PER_MT',
        numberOfContainers: containers,
        shipmentMonth: primary.shipmentMonthYear ? formatShipmentMonthDb(primary.shipmentMonthYear) : undefined,
        shipmentYear: primary.shipmentMonthYear ? Number(primary.shipmentMonthYear.split('-')[0]) : undefined,
        packingDescription: buildPackingDescription(),
        cifPrice: form.cifManualOverride ? form.cifPrice : (autoCif ? parseFloat(autoCif) : form.cifPrice),
        originalContractPrice: form.originalContractPrice ?? form.fobPrice,
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

      const created = await api.submitContract({
        contract: contractPayload,
        pendingMasters: hasPendingMasters(pendingMasters) ? pendingMasters : undefined,
        buyerUpdate,
      });
      invalidateQueryCache('dashboard');
      invalidateQueryCache('contracts');
      invalidateQueryCache('masters:offices');
      invalidateQueryCache('masters:salespersons');
      invalidateQueryCache('masters:buyers');
      invalidateQueryCache('masters:products');
      invalidateQueryCache('masters:packaging');
      invalidateQueryCache('masters:countries');
      const successQuery = finalStatus === 'DRAFT' ? 'draft=1' : 'created=1';
      router.push(`/contracts/${created.id}?${successQuery}`);
    } catch (e) {
      showError(e, 'Failed to save contract');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="New Contract" subtitle="Create a new export contract">
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
                    ...mergedOffices.map((o) => ({ value: o.id, label: o.name })),
                    { value: ADD_OPTION_VALUE, label: '+ Add other office name' },
                  ]}
                />
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
              <Field label="Salesperson">
                <EmsSelect
                  searchable
                  value={form.salespersonId || ''}
                  onChange={(v) => setField('salespersonId', v)}
                  placeholder="Select salesperson"
                  addOptionValue={ADD_OPTION_VALUE}
                  onAddSelect={() => setAddPanel('salesperson')}
                  options={[
                    { value: '', label: 'Select salesperson' },
                    ...mergedSalespersons.map((s) => ({ value: s.id, label: s.name })),
                    { value: ADD_OPTION_VALUE, label: '+ Add Salesperson...' },
                  ]}
                />
                {addPanel === 'salesperson' && (
                  <InlineAddPanel
                    title="Add salesperson"
                    fields={[{ key: 'name', label: 'Salesperson name', placeholder: 'Full name' }]}
                    onCancel={() => setAddPanel(null)}
                    onSave={async (values) => {
                      const { pending, sp } = addPendingSalesperson(pendingMasters, values.name);
                      setPendingMasters(pending);
                      setField('salespersonId', sp.id);
                      setAddPanel(null);
                    }}
                  />
                )}
              </Field>
            </div>
            <Field label="Contract Sent Date">
              <input type="date" className="ems-input" value={form.contractSentDate || ''} onChange={(e) => setField('contractSentDate', e.target.value)} />
            </Field>
            <Field label="Contract Date">
              <input type="date" className="ems-input" value={form.contractDate || ''} onChange={(e) => setField('contractDate', e.target.value)} />
            </Field>
            <Field label="Contract Number" hint="Auto: CONT/2026/0001 if blank">
              <input className="ems-input" placeholder="e.g. 05610 or CONT/2026/0010" value={form.contractNumber || ''} onChange={(e) => setField('contractNumber', e.target.value)} />
            </Field>
            <Field label="Signed Contract Received Date">
              <input type="date" className="ems-input" value={form.signedContractReceivedDate || ''} onChange={(e) => setField('signedContractReceivedDate', e.target.value)} />
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
                onAddSelect={() => setAddPanel('buyer')}
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

            {containerProducts.map((cp, idx) => (
              <ContainerShipmentSection
                key={idx}
                index={idx}
                data={cp}
                ports={masters.ports}
                showCopyButton={idx > 0}
                onCopyFromFirst={() => copyContainerShipmentFromFirst(idx)}
                onPatch={(patch) => patchContainerProduct(idx, patch)}
              />
            ))}
          </div>
        )}

        {/* Product — one form per container */}
        {step === 3 && (
          <div>
            {containerProducts.map((cp, idx) => (
              <ContainerProductSection
                key={idx}
                index={idx}
                data={cp}
                products={mergedProducts}
                showCopyButton={idx > 0}
                onCopyFromFirst={() => copyContainerFromFirst(idx)}
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
              />
            ))}
          </div>
        )}

        {/* Commercial */}
        {step === 4 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Incoterm (FOB / CIF / CNF)">
              <EmsSelect
                value={form.incoterm || 'FOB'}
                onChange={(v) => setField('incoterm', v)}
                options={[
                  { value: 'FOB', label: 'FOB' },
                  { value: 'CIF', label: 'CIF' },
                  { value: 'CNF', label: 'CNF' },
                ]}
              />
            </Field>
            <Field label="FOB Price">
              <input type="number" step="0.01" className="ems-input" value={form.fobPrice ?? ''} onChange={(e) => setField('fobPrice', parseFloat(e.target.value))} />
            </Field>
            <Field label="FOB Currency">
              <EmsSelect
                value={form.fobCurrency || 'USD'}
                onChange={(v) => setField('fobCurrency', v)}
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'EUR', label: 'EUR' },
                  { value: 'INR', label: 'INR' },
                ]}
              />
            </Field>
            <Field label="Exchange Rate">
              <input type="number" step="0.0001" className="ems-input" value={form.exchangeRate ?? ''} onChange={(e) => setField('exchangeRate', parseFloat(e.target.value))} />
            </Field>
            <Field label="FOB INR Per KG"><ReadOnly value={fobInrPerKg} /></Field>
            <Field label="Freight">
              <input type="number" step="0.01" className="ems-input" value={form.freight ?? ''} onChange={(e) => setField('freight', parseFloat(e.target.value))} />
            </Field>
            <Field label="Freight Unit">
              <EmsSelect
                value={form.freightUnit || 'PER_CONTAINER'}
                onChange={(v) => setField('freightUnit', v)}
                options={[
                  { value: 'PER_CONTAINER', label: 'Per Container' },
                  { value: 'PER_MT', label: 'Per MT' },
                  { value: 'TOTAL_CONTRACT', label: 'Total Contract' },
                ]}
              />
            </Field>
            <Field label="Insurance">
              <input type="number" step="0.01" className="ems-input" value={form.insurance ?? ''} onChange={(e) => setField('insurance', parseFloat(e.target.value))} />
            </Field>
            <Field label="CIF Price">
              <input type="number" step="0.01" className="ems-input" disabled={!form.cifManualOverride}
                value={form.cifManualOverride ? (form.cifPrice ?? '') : autoCif}
                onChange={(e) => setField('cifPrice', parseFloat(e.target.value))} />
            </Field>
            <Field label="CIF Entry Mode" className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.cifManualOverride || false} onChange={(e) => setField('cifManualOverride', e.target.checked)} />
                Manual CIF override (when currencies/units differ)
              </label>
            </Field>
            <Field label="Original Contract Price">
              <input type="number" step="0.01" className="ems-input" value={form.originalContractPrice ?? form.fobPrice ?? ''} onChange={(e) => setField('originalContractPrice', parseFloat(e.target.value))} />
            </Field>
            <Field label="Amendment Price">
              <input type="number" step="0.01" className="ems-input" value={form.amendmentPrice ?? ''} onChange={(e) => setField('amendmentPrice', parseFloat(e.target.value))} />
            </Field>
            <Field label="Amendment Currency">
              <EmsSelect
                value={form.amendmentCurrency || ''}
                onChange={(v) => setField('amendmentCurrency', v)}
                placeholder="Select currency"
                options={[
                  { value: '', label: '—' },
                  { value: 'USD', label: 'USD' },
                  { value: 'EUR', label: 'EUR' },
                  { value: 'INR', label: 'INR' },
                ]}
              />
            </Field>
            <Field label="Amendment Date">
              <input type="date" className="ems-input" value={form.amendmentDate || ''} onChange={(e) => setField('amendmentDate', e.target.value)} />
            </Field>
            <Field label="Amendment Reason" className="sm:col-span-2">
              <textarea className="ems-input min-h-[72px]" value={form.amendmentReason || ''} onChange={(e) => setField('amendmentReason', e.target.value)} placeholder="Mandatory when price is amended" />
            </Field>
            <Field label="Commercial Remarks" className="sm:col-span-2">
              <textarea className="ems-input min-h-[72px]" value={form.commercialRemarks || ''} onChange={(e) => setField('commercialRemarks', e.target.value)} />
            </Field>
          </div>
        )}

        {/* Packaging & Payment */}
        {step === 5 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Packing Material">
              <EmsSelect
                value={form.packagingTypeId || ''}
                onChange={(v) => setField('packagingTypeId', v)}
                placeholder="Select type"
                addOptionValue={ADD_OPTION_VALUE}
                onAddSelect={() => setAddPanel('packaging')}
                options={[
                  { value: '', label: 'Select type' },
                  ...mergedPackaging.map((p) => ({ value: p.id, label: p.name })),
                  { value: ADD_OPTION_VALUE, label: '+ Add packaging material' },
                ]}
              />
              {addPanel === 'packaging' && (
                <InlineAddPanel
                  title="Add packaging material"
                  fields={[{ key: 'name', label: 'Material name', placeholder: 'e.g. PP' }]}
                  onCancel={() => setAddPanel(null)}
                  onSave={async (values) => {
                    const { pending, pkg } = addPendingPackagingType(pendingMasters, values.name);
                    setPendingMasters(pending);
                    setField('packagingTypeId', pkg.id);
                    setAddPanel(null);
                  }}
                />
              )}
            </Field>
            <Field label="Preset Packing Size">
              <EmsSelect
                value={form.packagingSizeId || ''}
                onChange={(v) => {
                  if (v === ADD_OPTION_VALUE) {
                    setAddPanel('packagingSize');
                    return;
                  }
                  const size = packagingSizesForType.find((s) => s.id === v);
                  setField('packagingSizeId', v);
                  if (size) {
                    setField('packingDescription', size.label);
                    setField('packingSizeValue', size.weightKg);
                    setField('packingSizeUnit', size.weightUnit || 'KG');
                  }
                }}
                placeholder="Select preset (optional)"
                addOptionValue={ADD_OPTION_VALUE}
                onAddSelect={() => setAddPanel('packagingSize')}
                options={[
                  { value: '', label: 'Select preset (optional)' },
                  ...packagingSizesForType.map((s) => ({ value: s.id, label: s.label })),
                  { value: ADD_OPTION_VALUE, label: '+ Add packaging size' },
                ]}
              />
              {addPanel === 'packagingSize' && (
                <InlineAddPanel
                  title="Add packaging size"
                  fields={[
                    { key: 'weightValue', label: 'Size (number)', type: 'number', placeholder: '25' },
                    { key: 'weightUnit', label: 'Unit', placeholder: 'KG' },
                  ]}
                  onCancel={() => setAddPanel(null)}
                  onSave={async (values) => {
                    const typeId = form.packagingTypeId || mergedPackaging[0]?.id;
                    if (!typeId) throw new Error('Select packaging material first');
                    const { pending, size } = addPendingPackagingSize(
                      pendingMasters,
                      typeId,
                      parseFloat(values.weightValue),
                      values.weightUnit || 'KG',
                      mergedPackaging,
                    );
                    setPendingMasters(pending);
                    setField('packagingSizeId', size.id);
                    setField('packingSizeValue', size.weightKg);
                    setField('packingSizeUnit', size.weightUnit || 'KG');
                    setField('packingDescription', size.label);
                    setAddPanel(null);
                  }}
                />
              )}
            </Field>
            <Field label="Packing Size">
              <input
                type="number"
                min={1}
                className="ems-input"
                value={form.packingSizeValue ?? ''}
                onChange={(e) => setField('packingSizeValue', parseFloat(e.target.value))}
                placeholder="e.g. 25"
              />
            </Field>
            <Field label="Packing Size Unit">
              <EmsSelect
                value={form.packingSizeUnit || 'KG'}
                onChange={(v) => setField('packingSizeUnit', v)}
                options={PACKING_SIZE_UNITS.map((u) => ({ value: u.value, label: u.label }))}
              />
            </Field>
            {form.packingSizeUnit === 'OTHERS' && (
              <Field label="Other unit" className="sm:col-span-2">
                <input
                  className="ems-input"
                  placeholder="Specify unit"
                  value={form.packingSizeUnitCustom || ''}
                  onChange={(e) => setField('packingSizeUnitCustom', e.target.value)}
                />
              </Field>
            )}
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
            </Field>
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
                {form.balancePaymentMode === 'OTHERS' && (
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
              <ReviewField label="Incoterm" value={form.incoterm} />
              <ReviewField label="FOB Price" value={form.fobPrice != null ? `${form.fobPrice} ${form.fobCurrency || 'USD'}` : undefined} />
              <ReviewField label="Freight" value={form.freight} />
              <ReviewField label="Insurance" value={form.insurance} />
              <ReviewField label="CIF Price" value={form.cifManualOverride ? form.cifPrice : autoCif} />
              <ReviewField label="FOB INR / Kg" value={fobInrPerKg} />
              <ReviewField label="Exchange Rate" value={form.exchangeRate} />
              <ReviewField label="Original Price" value={form.originalContractPrice ?? form.fobPrice} />
              <ReviewField label="Amendment Price" value={form.amendmentPrice} />
            </ReviewSection>

            <ReviewSection title="Packaging & Payment">
              <ReviewField
                label="Packing Material"
                value={mergedPackaging.find((p) => p.id === form.packagingTypeId)?.name}
              />
              <ReviewField label="Packing Size" value={buildPackingDescription()} />
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
    </AppShell>
  );
}
