'use client';

import { Field, ReadOnly } from '@/components/contracts/form-fields';
import { FieldError } from '@/components/contracts/field-error';
import { EmsSelect } from '@/components/ui/ems-select';
import type { ContainerProduct, Port } from '@/lib/api';
import { ADD_OPTION_VALUE } from '@/lib/form-constants';
import { CONTAINER_FIELD_LABELS } from '@/lib/contract-labels';
import { deriveShipmentFromExpectedDate, shipmentPeriodReadOnly } from '@/lib/shipment-period';

type ContainerShipmentSectionProps = {
  index: number;
  data: ContainerProduct;
  ports: Port[];
  showCopyButton: boolean;
  onCopyFromFirst: () => void;
  onPatch: (patch: Partial<ContainerProduct>) => void;
  onAddPort?: () => void;
  errors?: Record<string, string>;
};

export function ContainerShipmentSection({
  index,
  data,
  ports,
  showCopyButton,
  onCopyFromFirst,
  onPatch,
  onAddPort,
  errors = {},
}: ContainerShipmentSectionProps) {
  const { month, period } = shipmentPeriodReadOnly(data.expectedShipmentDate);

  function onExpectedDateChange(value: string) {
    const derived = deriveShipmentFromExpectedDate(value);
    onPatch({
      expectedShipmentDate: value,
      shipmentMonthYear: derived.shipmentMonthYear,
      shipmentHalf: derived.shipmentHalf,
    });
  }

  return (
    <div className={index > 0 ? 'mt-8 border-t border-slate-200 pt-8' : 'mt-4'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-800">Container {index + 1} — Shipment</h3>
        {showCopyButton && (
          <button type="button" onClick={onCopyFromFirst} className="ems-btn-secondary text-sm">
            Copy details from previous container
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Allocated Quantity / MT">
          <input
            type="number"
            step="0.001"
            min={0.001}
            className="ems-input"
            value={data.quantityMt ?? ''}
            onChange={(e) => onPatch({ quantityMt: parseFloat(e.target.value) || undefined })}
          />
          <FieldError message={errors[`container_${index}_quantityMt`]} />
        </Field>

        <Field label="Destination Port — Country">
          <EmsSelect
            searchable
            value={data.destinationPortId || ''}
            onChange={(v) => {
              if (v === ADD_OPTION_VALUE) {
                onAddPort?.();
                return;
              }
              onPatch({ destinationPortId: v });
            }}
            placeholder="Select port"
            addOptionValue={onAddPort ? ADD_OPTION_VALUE : undefined}
            onAddSelect={onAddPort}
            options={[
              { value: '', label: 'Select port' },
              ...ports.filter((p) => p.portType !== 'LOADING' && p.isActive !== false).map((p) => ({ value: p.id, label: p.name })),
              ...(onAddPort ? [{ value: ADD_OPTION_VALUE, label: '+ Add new port' }] : []),
            ]}
          />
          <FieldError message={errors[`container_${index}_destinationPortId`]} />
        </Field>

        <Field label={CONTAINER_FIELD_LABELS.expectedShipmentDate}>
          <input
            type="date"
            className="ems-input"
            value={data.expectedShipmentDate || ''}
            onChange={(e) => onExpectedDateChange(e.target.value)}
          />
          <FieldError message={errors[`container_${index}_expectedShipmentDate`]} />
        </Field>

        <Field label={CONTAINER_FIELD_LABELS.shipmentMonth}>
          <ReadOnly value={month} />
        </Field>

        <Field label={CONTAINER_FIELD_LABELS.shipmentPeriod}>
          <ReadOnly value={period} />
        </Field>

        <Field label={CONTAINER_FIELD_LABELS.shippingContainerNo}>
          <input
            className="ems-input"
            placeholder="Optional — enter when available"
            value={data.containerNo || ''}
            onChange={(e) => onPatch({ containerNo: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
