'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/sidebar';
import { Field, ReadOnly, StepPills, ON_BEHALF_OPTIONS, CONTRACT_STATUSES, ReviewSection, ReviewField } from '@/components/contracts/form-fields';
import { EmsSelect } from '@/components/ui/ems-select';
import { api, ContractForm, Salesperson, Buyer, Product, PackagingType, Port, Office } from '@/lib/api';
import { invalidateQueryCache } from '@/lib/use-cached-query';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';

const STEPS = [
  'Basic Info',
  'Buyer',
  'Product',
  'Commercial',
  'Qty & Shipment',
  'Packaging & Payment',
  'Review',
];

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
  }>({ offices: [], salespersons: [], buyers: [], products: [], packaging: [], ports: [] });

  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ems_user') || '{}') : {};

  const [form, setForm] = useState<ContractForm>({
    officeId: '',
    receivedDate: new Date().toISOString().slice(0, 10),
    contractDate: new Date().toISOString().slice(0, 10),
    buyerId: '',
    productId: '',
    totalMt: 28,
    quantityUnit: 'MT',
    fobCurrency: 'USD',
    fobPriceUnit: 'PER_MT',
    freightUnit: 'PER_CONTAINER',
    incoterm: 'FOB',
    paymentType: 'ADVANCE',
    advancePercentage: 10,
    status: 'DRAFT',
    cifManualOverride: false,
  });

  useEffect(() => {
    Promise.all([
      api.offices(),
      api.masters.salespersons(),
      api.masters.buyers(),
      api.masters.products(),
      api.masters.packaging(),
      api.masters.ports(),
    ]).then(([offices, salespersons, buyers, products, packaging, ports]) => {
      setMasters({ offices, salespersons, buyers, products, packaging, ports });
      const amd = offices.find((o) => o.code === 'AMD') || offices[0];
      if (amd) setForm((f) => ({ ...f, officeId: user.officeId || amd.id }));
    });
  }, [user.officeId]);

  const selectedBuyer = masters.buyers.find((b) => b.id === form.buyerId);
  const selectedProduct = masters.products.find((p) => p.id === form.productId);
  const processingOptions = useMemo(() => {
    if (!selectedProduct?.variants?.length) return [];
    const types = selectedProduct.variants.map((v) => v.processingType || v.name).filter(Boolean);
    return [...new Set(types)] as string[];
  }, [selectedProduct]);

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

  const containers = useMemo(() => Math.ceil((form.totalMt || 0) / 28), [form.totalMt]);

  function setField<K extends keyof ContractForm>(key: K, value: ContractForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onBuyerChange(buyerId: string) {
    const buyer = masters.buyers.find((b) => b.id === buyerId);
    setForm((f) => ({
      ...f,
      buyerId,
      euClassification: buyer?.euClassification || buyer?.country?.euClassification || f.euClassification,
      buyerAddress: buyer?.address || '',
      buyerContactPerson: buyer?.contactPerson || '',
      buyerEmail: buyer?.email || '',
      buyerPhone: buyer?.phone || '',
    }));
  }

  async function syncBuyerToMaster() {
    if (!form.buyerId) return;
    const updated = await api.masters.updateBuyer(form.buyerId, {
      address: form.buyerAddress,
      contactPerson: form.buyerContactPerson,
      email: form.buyerEmail,
      phone: form.buyerPhone,
      euClassification: form.euClassification || undefined,
    });
    setMasters((m) => ({
      ...m,
      buyers: m.buyers.map((b) => (b.id === updated.id ? updated : b)),
    }));
    invalidateQueryCache('masters:buyers');
  }

  async function goToStep(nextStep: number) {
    if (step === 1 && nextStep !== 1 && form.buyerId) {
      try {
        await syncBuyerToMaster();
      } catch (e) {
        alert('Failed to save buyer details to master');
        console.error(e);
        return;
      }
    }
    setStep(nextStep);
  }

  async function goNext() {
    if (step === 1 && form.buyerId) {
      try {
        await syncBuyerToMaster();
      } catch (e) {
        alert('Failed to save buyer details to master');
        console.error(e);
        return;
      }
    }
    setStep(step + 1);
  }

  function onProductChange(productId: string) {
    const product = masters.products.find((p) => p.id === productId);
    setForm((f) => ({
      ...f,
      productId,
      productVariantId: undefined,
      processingType: undefined,
      specification: product?.defaultSpecification || f.specification,
    }));
  }

  async function handleSubmit(finalStatus = 'UNDER_PREPARATION') {
    setLoading(true);
    try {
      if (form.buyerId) {
        await syncBuyerToMaster();
      }
      const { buyerAddress, buyerContactPerson, buyerEmail, buyerPhone, ...contractData } = form;
      const payload: ContractForm = {
        ...contractData,
        status: finalStatus,
        cifPrice: form.cifManualOverride ? form.cifPrice : (autoCif ? parseFloat(autoCif) : form.cifPrice),
        originalContractPrice: form.originalContractPrice ?? form.fobPrice,
      };
      const created = await api.createContract(payload);
      invalidateQueryCache('dashboard');
      invalidateQueryCache('contracts');
      router.push(`/contracts/${created.id}`);
    } catch (e) {
      alert('Failed to save contract');
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
            <Field label="Office">
              <EmsSelect
                value={form.officeId}
                onChange={(v) => setField('officeId', v)}
                placeholder="Select office"
                options={masters.offices.map((o) => ({ value: o.id, label: o.name }))}
              />
            </Field>
            <Field label="Salesperson">
              <EmsSelect
                searchable
                value={form.salespersonId || ''}
                onChange={(v) => setField('salespersonId', v)}
                placeholder="Select salesperson"
                options={[
                  { value: '', label: 'Select salesperson' },
                  ...masters.salespersons.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </Field>
            <Field label="Contract On Behalf Of">
              <input list="on-behalf-list" className="ems-input" placeholder="Company / agent / representative"
                value={form.contractOnBehalfOf || ''} onChange={(e) => setField('contractOnBehalfOf', e.target.value)} />
              <datalist id="on-behalf-list">{ON_BEHALF_OPTIONS.map((o) => <option key={o} value={o} />)}</datalist>
            </Field>
            <Field label="Contract Sent Date">
              <input type="date" className="ems-input" value={form.contractSentDate || ''} onChange={(e) => setField('contractSentDate', e.target.value)} />
            </Field>
            <Field label="Date / When We Got By">
              <input type="date" className="ems-input" value={form.receivedDate || ''} onChange={(e) => setField('receivedDate', e.target.value)} />
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
            <Field label="Buyer Name">
              <EmsSelect
                searchable
                value={form.buyerId}
                onChange={onBuyerChange}
                placeholder="Select buyer"
                options={[
                  { value: '', label: 'Select buyer' },
                  ...masters.buyers.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
            </Field>
            <Field label="Buyer Code"><ReadOnly value={selectedBuyer?.code} /></Field>
            <Field label="Country Name"><ReadOnly value={selectedBuyer?.country?.name} /></Field>
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
            <Field label="Buyer Lot No.">
              <input className="ems-input" value={form.buyerLotNo || ''} onChange={(e) => setField('buyerLotNo', e.target.value)} />
            </Field>
            <Field label="Buyer Remarks" className="sm:col-span-2">
              <textarea className="ems-input min-h-[72px]" value={form.buyerRemarks || ''} onChange={(e) => setField('buyerRemarks', e.target.value)} placeholder="Optional buyer-related instructions" />
            </Field>
          </div>
        )}

        {/* SECTION C */}
        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product Name">
              <EmsSelect
                searchable
                value={form.productId}
                onChange={onProductChange}
                placeholder="Select product"
                options={[
                  { value: '', label: 'Select product' },
                  ...masters.products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
                ]}
              />
            </Field>
            <Field label="Product Variant">
              <EmsSelect
                value={form.productVariantId || ''}
                onChange={(v) => {
                  const variant = selectedProduct?.variants?.find((x) => x.id === v);
                  setField('productVariantId', v);
                  if (variant?.processingType) setField('processingType', variant.processingType);
                }}
                placeholder="Select variant"
                options={[
                  { value: '', label: 'Select variant' },
                  ...(selectedProduct?.variants?.map((v) => ({ value: v.id, label: v.name })) ?? []),
                ]}
              />
            </Field>
            <Field label="Processing Type">
              <EmsSelect
                value={form.processingType || ''}
                onChange={(v) => setField('processingType', v)}
                placeholder="Select processing"
                options={[
                  { value: '', label: 'Select processing' },
                  ...processingOptions.map((t) => ({ value: t, label: t })),
                ]}
              />
            </Field>
            <Field label="Quantity">
              <input type="number" step="0.001" className="ems-input" value={form.totalMt} onChange={(e) => setField('totalMt', parseFloat(e.target.value))} />
            </Field>
            <Field label="Quantity Unit">
              <EmsSelect
                value={form.quantityUnit || 'MT'}
                onChange={(v) => setField('quantityUnit', v)}
                options={[
                  { value: 'MT', label: 'Metric Tons (MT)' },
                  { value: 'KG', label: 'Kilograms (KG)' },
                ]}
              />
            </Field>
            <Field label="Product Specification" className="sm:col-span-2">
              <textarea className="ems-input min-h-[72px]" value={form.specification || ''} onChange={(e) => setField('specification', e.target.value)} />
            </Field>
            <Field label="Quality Requirement" className="sm:col-span-2">
              <textarea className="ems-input min-h-[72px]" value={form.qualityRequirement || ''} onChange={(e) => setField('qualityRequirement', e.target.value)} placeholder="Buyer-specific quality requirements" />
            </Field>
            <Field label="Product Remarks" className="sm:col-span-2">
              <textarea className="ems-input min-h-[72px]" value={form.productRemarks || ''} onChange={(e) => setField('productRemarks', e.target.value)} />
            </Field>
          </div>
        )}

        {/* SECTION D */}
        {step === 3 && (
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
            <Field label="FOB Price Unit">
              <EmsSelect
                value={form.fobPriceUnit || 'PER_MT'}
                onChange={(v) => setField('fobPriceUnit', v)}
                options={[
                  { value: 'PER_MT', label: 'Per MT' },
                  { value: 'PER_KG', label: 'Per KG' },
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

        {/* Qty & Shipment */}
        {step === 4 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Total MT"><ReadOnly value={form.totalMt} /></Field>
            <Field label="No. of FCL"><ReadOnly value={containers} /></Field>
            <Field label="Destination Port — Country">
              <EmsSelect
                searchable
                value={form.destinationPortId || ''}
                onChange={(v) => setField('destinationPortId', v)}
                placeholder="Select port"
                options={[
                  { value: '', label: 'Select port' },
                  ...masters.ports.filter((p) => p.portType !== 'LOADING').map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </Field>
            <Field label="Expected Shipment Date">
              <input type="date" className="ems-input" value={form.expectedShipmentDate || ''} onChange={(e) => setField('expectedShipmentDate', e.target.value)} />
            </Field>
            <Field label="Container No. (later)">
              <input className="ems-input" value={form.containerNo || ''} onChange={(e) => setField('containerNo', e.target.value)} />
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
                options={[
                  { value: '', label: 'Select type' },
                  ...masters.packaging.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </Field>
            <Field label="Packing Size">
              <EmsSelect
                value={form.packagingSizeId || ''}
                onChange={(v) => {
                  const size = masters.packaging.flatMap((p) => p.sizes || []).find((s) => s.id === v);
                  setField('packagingSizeId', v);
                  if (size) setField('packingDescription', size.label);
                }}
                placeholder="Select size"
                options={[
                  { value: '', label: 'Select size' },
                  ...masters.packaging.flatMap((p) => p.sizes || []).map((s) => ({ value: s.id, label: s.label })),
                ]}
              />
            </Field>
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
                <Field label="Balance Payment Stage">
                  <input className="ems-input" value={form.balancePaymentStage || ''} onChange={(e) => setField('balancePaymentStage', e.target.value)} placeholder="AGAINST COPY OF DOCUMENTS" />
                </Field>
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
              <ReviewField label="Salesperson" value={masters.salespersons.find((s) => s.id === form.salespersonId)?.name} />
              <ReviewField label="On Behalf Of" value={form.contractOnBehalfOf} />
              <ReviewField label="Contract No." value={form.contractNumber || 'Auto-generated'} />
              <ReviewField label="Status" value={CONTRACT_STATUSES.find((s) => s.value === form.status)?.label ?? form.status} />
              <ReviewField label="Contract Date" value={form.contractDate} />
              <ReviewField label="Date / When We Got By" value={form.receivedDate} />
            </ReviewSection>

            <ReviewSection title="Section B — Buyer">
              <ReviewField label="Buyer" value={selectedBuyer?.name} />
              <ReviewField label="Buyer Code" value={selectedBuyer?.code} />
              <ReviewField label="Country" value={selectedBuyer?.country?.name} />
              <ReviewField label="EU / Non-EU" value={form.euClassification || selectedBuyer?.country?.euClassification} />
              <ReviewField label="Contact Person" value={form.buyerContactPerson} />
              <ReviewField label="Buyer Lot No." value={form.buyerLotNo} />
              <ReviewField label="Address" value={form.buyerAddress} className="sm:col-span-2" />
              <ReviewField label="Email" value={form.buyerEmail} />
              <ReviewField label="Phone" value={form.buyerPhone} />
            </ReviewSection>

            <ReviewSection title="Section C — Product">
              <ReviewField label="Product" value={selectedProduct ? `${selectedProduct.code} — ${selectedProduct.name}` : undefined} />
              <ReviewField label="Processing" value={form.processingType} />
              <ReviewField label="Quantity" value={`${form.totalMt} ${form.quantityUnit || 'MT'}`} />
              <ReviewField label="Specification" value={form.specification} className="sm:col-span-2" />
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

            <ReviewSection title="Qty, Shipment & Payment">
              <ReviewField label="Total Quantity" value={`${form.totalMt} ${form.quantityUnit || 'MT'}`} />
              <ReviewField label="No. of FCL" value={containers} />
              <ReviewField
                label="Destination Port"
                value={masters.ports.find((p) => p.id === form.destinationPortId)?.name}
              />
              <ReviewField label="Expected Shipment" value={form.expectedShipmentDate} />
              <ReviewField label="Container No." value={form.containerNo} />
              <ReviewField
                label="Packing"
                value={form.packingDescription || masters.packaging.flatMap((p) => p.sizes || []).find((s) => s.id === form.packagingSizeId)?.label}
              />
              <ReviewField
                label="Payment Term"
                value={
                  form.paymentType === 'ADVANCE'
                    ? `Advance ${form.advancePercentage ?? 10}%`
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
              <button type="button" disabled={loading || !form.buyerId || !form.productId} onClick={() => handleSubmit('UNDER_PREPARATION')} className="ems-btn-primary">
                {loading ? 'Saving...' : 'Submit Contract'}
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
