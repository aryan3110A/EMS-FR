'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/sidebar';
import { ContractDetailSkeleton } from '@/components/ui/page-loader';
import { Field, StepPills, CONTRACT_STATUSES, ReviewSection, ReviewField } from '@/components/contracts/form-fields';
import { ContainerCommercialSection } from '@/components/contracts/container-commercial-section';
import { ContainerProductSection } from '@/components/contracts/container-product-section';
import { ContainerShipmentSection } from '@/components/contracts/container-shipment-section';
import { EmsSelect } from '@/components/ui/ems-select';
import { AutosaveIndicator, useAutosave } from '@/hooks/use-autosave';
import { api, ContractForm, ContainerProduct, Port } from '@/lib/api';
import { BASIC_DATE_LABELS } from '@/lib/contract-labels';
import {
  buildContainerProductsPayload,
  contractToContainerProducts,
  contractToForm,
} from '@/lib/contract-form-mapper';
import { enrichContainerCommercial } from '@/lib/commercial-calculations';
import { invalidateQueryCache, useCachedQuery } from '@/lib/use-cached-query';
import { showError, showSuccess } from '@/lib/toast';
import { AddPortModal } from '@/components/ports/add-port-modal';
import { distributeContainerMt, validateStep } from '@/lib/contract-validation';
import { formatShipmentPeriodLabel } from '@/lib/shipment-period';
import { ArrowLeft, Save, ShieldAlert } from 'lucide-react';

const STEPS = ['Basic Info', 'Buyer', 'Quantity', 'Product', 'Commercial', 'Review'];

export default function EditContractPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ContractForm | null>(null);
  const [containerProducts, setContainerProducts] = useState<ContainerProduct[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('ems_user') || '{}');
      setUserRole(u.role || 'GUEST');
    } catch {
      setUserRole('GUEST');
    }
  }, []);
  const [ports, setPorts] = useState<Port[]>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<typeof api.masters.products>>>([]);
  const [buyers, setBuyers] = useState<Awaited<ReturnType<typeof api.masters.buyers>>>([]);
  const [salespersons, setSalespersons] = useState<Awaited<ReturnType<typeof api.masters.salespersons>>>([]);
  const [showPortModal, setShowPortModal] = useState(false);
  const [portModalIndex, setPortModalIndex] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [countries, setCountries] = useState<Awaited<ReturnType<typeof api.masters.countries>>>([]);

  const { data: contract, loading } = useCachedQuery(
    id ? `contract:${id}` : 'contract:unknown',
    () => api.contract(id!),
  );

  useEffect(() => {
    if (!contract) return;
    setForm(contractToForm(contract));
    setContainerProducts(contractToContainerProducts(contract));
  }, [contract]);


  useEffect(() => {
    Promise.all([
      api.masters.ports(),
      api.masters.products(),
      api.masters.buyers(),
      api.masters.salespersons(),
      api.masters.countries(),
      api.masters.countries(),
    ]).then(([p, pr, b, s, c]) => {
      setPorts(p);
      setProducts(pr);
      setBuyers(b);
      setSalespersons(s);
      setCountries(c);
    });
  }, []);

  const containers = form?.numberOfContainers ?? 1;

  const savePayload = useCallback(async () => {
    if (!form || !id) return;
    const payload = {
      ...form,
      containerProducts: buildContainerProductsPayload(containerProducts, form.totalMt),
      numberOfContainers: containers,
    };
    await api.updateContract(id, payload);
    invalidateQueryCache(`contract:${id}`);
    invalidateQueryCache('contracts');
    invalidateQueryCache('dashboard');
  }, [form, containerProducts, containers, id]);

  const { status: autosaveStatus } = useAutosave(
    { form, containerProducts },
    async () => {
      if (form?.status === 'DRAFT') await savePayload();
    },
    { enabled: !!form && form.status === 'DRAFT' },
  );

  const [refreshingIdx, setRefreshingIdx] = useState<number | null>(null);

  function patchContainer(index: number, patch: Partial<ContainerProduct>) {
    setContainerProducts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  async function refreshExchangeRate(containerIndex: number, currencyOverride?: string) {
    const currency = currencyOverride || containerProducts[containerIndex].fobCurrency || 'USD';
    if (currencyOverride) {
      patchContainer(containerIndex, { fobCurrency: currencyOverride });
    }
    setRefreshingIdx(containerIndex);
    try {
      const { rate, source, fetchedAt } = await api.exchangeRate(currency);
      patchContainer(containerIndex, {
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

  async function handleSave() {
    if (!form || !id) return;
    setSaving(true);
    try {
      await savePayload();
      showSuccess('Contract updated');
      router.push(`/contracts/${id}`);
    } catch (e) {
      showError(e, 'Failed to update contract');
    } finally {
      setSaving(false);
    }
  }

  const selectedBuyer = useMemo(() => buyers.find((b) => b.id === form?.buyerId), [buyers, form?.buyerId]);

  if (userRole === null || loading || !form) {
    return (
      <AppShell title="Edit Contract">
        <ContractDetailSkeleton />
      </AppShell>
    );
  }

  if (!['SUPER_ADMIN', 'OFFICE_ADMIN', 'CONTRACT_TEAM'].includes(userRole)) {
    return (
      <AppShell title="Access Denied">
        <div className="ems-card p-5 text-center text-red-500 font-semibold flex flex-col items-center justify-center gap-3">
          <ShieldAlert className="h-10 w-10 text-rose-500" />
          <p>Access Denied. You do not have permission to edit contracts.</p>
          <Link href="/dashboard" className="ems-btn-primary text-xs mt-2">
            Back to Dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!contract) {
    return (
      <AppShell title="Edit Contract">
        <p className="text-center text-sm text-slate-500">Contract not found.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={`Edit ${contract.contractNumber}`} subtitle="Update contract details">
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/contracts/${id}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to contract
        </Link>
        <AutosaveIndicator status={autosaveStatus} />
      </div>

      <StepPills steps={STEPS} current={step} onStepClick={setStep} />

      <div className="ems-card max-w-5xl space-y-6 p-6">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Salesperson">
              <EmsSelect
                value={form.salespersonId || ''}
                onChange={(v) => setForm({ ...form, salespersonId: v })}
                options={[
                  { value: '', label: 'Select salesperson' },
                  ...salespersons.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </Field>
            <Field label={BASIC_DATE_LABELS.contractSentDate}>
              <input type="date" className="ems-input" value={form.contractSentDate || ''} onChange={(e) => setForm({ ...form, contractSentDate: e.target.value })} />
            </Field>
            <Field label={BASIC_DATE_LABELS.contractDate}>
              <input type="date" className="ems-input" value={form.contractDate || ''} onChange={(e) => setForm({ ...form, contractDate: e.target.value })} />
            </Field>
            <Field label={BASIC_DATE_LABELS.receivedDate}>
              <input type="date" className="ems-input" value={form.receivedDate || ''} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} />
            </Field>
            <Field label={BASIC_DATE_LABELS.signedContractReceivedDate}>
              <input type="date" className="ems-input" value={form.signedContractReceivedDate || ''} onChange={(e) => setForm({ ...form, signedContractReceivedDate: e.target.value })} />
            </Field>
            <Field label="Status">
              <EmsSelect
                value={form.status || 'DRAFT'}
                onChange={(v) => setForm({ ...form, status: v })}
                options={CONTRACT_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
              />
            </Field>
            <Field label="Remarks" className="sm:col-span-2">
              <textarea className="ems-input" rows={3} value={form.remarks || ''} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Buyer" className="sm:col-span-2">
              <EmsSelect
                searchable
                value={form.buyerId}
                onChange={(v) => setForm({ ...form, buyerId: v })}
                options={[
                  { value: '', label: 'Select buyer' },
                  ...buyers.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
            </Field>
            <Field label="Buyer Code"><input className="ems-input" value={selectedBuyer?.code || form.buyerCode || ''} readOnly /></Field>
            <Field label="Country"><input className="ems-input" value={selectedBuyer?.country?.name || ''} readOnly /></Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="Total Quantity (MT)">
              <input type="number" className="ems-input" value={form.totalMt} onChange={(e) => setForm({ ...form, totalMt: parseFloat(e.target.value) || 0 })} />
            </Field>
            {containerProducts.map((cp, idx) => (
              <ContainerShipmentSection
                key={idx}
                index={idx}
                data={cp}
                ports={ports}
                showCopyButton={idx > 0}
                onCopyFromFirst={() => patchContainer(idx, { ...containerProducts[0] })}
                onPatch={(patch) => patchContainer(idx, patch)}
                errors={fieldErrors}
                onAddPort={() => {
                  setPortModalIndex(idx);
                  setShowPortModal(true);
                }}
              />
            ))}
          </div>
        )}

        {step === 3 && (
          <div>
            {containerProducts.map((cp, idx) => (
              <ContainerProductSection
                key={idx}
                index={idx}
                data={cp}
                products={products}
                showCopyButton={idx > 0}
                onCopyFromFirst={() => patchContainer(idx, { ...containerProducts[0] })}
                onChange={(field, value) => patchContainer(idx, { [field]: value })}
                onPatch={(patch) => patchContainer(idx, patch)}
                addPanel={null}
                isAddTarget={false}
                onOpenAddProduct={() => {}}
                onOpenAddVariant={() => {}}
                onCloseAddPanel={() => {}}
                onProductCreated={() => {}}
                createProduct={async () => products[0]}
                createVariant={async (productId) => products.find((p) => p.id === productId)!}
                onVariantCreated={() => {}}
              />
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            {containerProducts.map((cp, idx) => (
              <ContainerCommercialSection
                key={idx}
                container={{ ...cp, containerIndex: idx + 1, quantityMt: form.totalMt / containers }}
                onChange={(patch) => {
                  if (patch.fobCurrency !== undefined) {
                    refreshExchangeRate(idx, patch.fobCurrency);
                  } else {
                    patchContainer(idx, patch);
                  }
                }}
                onRefreshRate={() => refreshExchangeRate(idx)}
                isRefreshing={refreshingIdx === idx}
                showCopyButton={idx > 0}
                onCopyFromFirst={() => copyContainerCommercialFromPrevious(idx)}
              />
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <ReviewSection title="Basic">
              <ReviewField label="Contract No." value={contract.contractNumber} />
              <ReviewField label="Buyer" value={selectedBuyer?.name} />
              <ReviewField label="Total MT" value={form.totalMt} />
            </ReviewSection>
            <ReviewSection title="Commercial">
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
                  <div key={idx} className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                    <ReviewField label={`Container ${idx + 1} Incoterm`} value={cp.incoterm} />
                    <ReviewField label="FOB INR/Kg" value={calc.fobInrPerKg?.toFixed(2)} />
                    <ReviewField label="CIF" value={calc.cifPrice?.toFixed(2)} />
                    <ReviewField label="CNF" value={calc.cnfPrice?.toFixed(2)} />
                    <ReviewField
                      label="Shipment"
                      value={
                        cp.shipmentMonthYear && cp.shipmentHalf
                          ? formatShipmentPeriodLabel(cp.shipmentMonthYear, cp.shipmentHalf)
                          : cp.expectedShipmentDate
                      }
                    />
                  </div>
                );
              })}
            </ReviewSection>
          </div>
        )}

        <div className="flex justify-between border-t border-slate-100 pt-4">
          <button type="button" className="ems-btn-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Previous
          </button>
          <div className="flex gap-2">
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="ems-btn-primary"
                onClick={() => {
                  if (!form) return;
                  const { valid, errors } = validateStep(step, form, containerProducts, form.totalMt);
                  setFieldErrors(errors);
                  if (valid) setStep(step + 1);
                }}
              >
                Next
              </button>
            ) : (
              <button type="button" className="ems-btn-primary gap-1" disabled={saving} onClick={handleSave}>
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>

      <AddPortModal
        open={showPortModal}
        countries={countries}
        onClose={() => setShowPortModal(false)}
        onSaved={(port) => {
          setPorts((p) => [...p, port]);
          patchContainer(portModalIndex, { destinationPortId: port.id });
          setShowPortModal(false);
        }}
      />
    </AppShell>
  );
}
