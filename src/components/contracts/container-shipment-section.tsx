'use client';

import { Field, ReadOnly } from '@/components/contracts/form-fields';
import { EmsSelect } from '@/components/ui/ems-select';
import type { ContainerProduct, Port } from '@/lib/api';
import {
  formatShipmentPeriodLabel,
  getHalfMonthDateRange,
  SHIPMENT_HALF_OPTIONS,
  type ShipmentHalf,
} from '@/lib/shipment-period';

type ContainerShipmentSectionProps = {
  index: number;
  data: ContainerProduct;
  ports: Port[];
  showCopyButton: boolean;
  onCopyFromFirst: () => void;
  onPatch: (patch: Partial<ContainerProduct>) => void;
};

export function ContainerShipmentSection({
  index,
  data,
  ports,
  showCopyButton,
  onCopyFromFirst,
  onPatch,
}: ContainerShipmentSectionProps) {
  const shipmentDateRange =
    data.shipmentMonthYear && data.shipmentHalf
      ? getHalfMonthDateRange(data.shipmentMonthYear, data.shipmentHalf)
      : null;

  const shipmentPeriodLabel =
    data.shipmentMonthYear && data.shipmentHalf
      ? formatShipmentPeriodLabel(data.shipmentMonthYear, data.shipmentHalf)
      : '';

  return (
    <div className={index > 0 ? 'mt-8 border-t border-slate-200 pt-8' : 'mt-4'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-800">Container {index + 1} — Shipment</h3>
        {showCopyButton && (
          <button type="button" onClick={onCopyFromFirst} className="ems-btn-secondary text-sm">
            Same as Container 1
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destination Port — Country">
          <EmsSelect
            searchable
            value={data.destinationPortId || ''}
            onChange={(v) => onPatch({ destinationPortId: v })}
            placeholder="Select port"
            options={[
              { value: '', label: 'Select port' },
              ...ports.filter((p) => p.portType !== 'LOADING').map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </Field>
        <Field label="Shipment Month">
          <input
            type="month"
            className="ems-input"
            value={data.shipmentMonthYear || ''}
            onChange={(e) => onPatch({ shipmentMonthYear: e.target.value, expectedShipmentDate: '' })}
          />
        </Field>
        <Field label="Shipment Period">
          <EmsSelect
            value={data.shipmentHalf || ''}
            onChange={(v) => onPatch({ shipmentHalf: v as ShipmentHalf, expectedShipmentDate: '' })}
            placeholder="Select first or second half"
            options={[
              { value: '', label: 'Select half of month' },
              ...SHIPMENT_HALF_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
            ]}
          />
        </Field>
        {shipmentPeriodLabel && (
          <Field label="Selected Period">
            <ReadOnly value={shipmentPeriodLabel} />
          </Field>
        )}
        <Field
          label="Expected Shipment Date"
          hint={
            shipmentDateRange
              ? `Pick a date between ${shipmentDateRange.min} and ${shipmentDateRange.max}`
              : 'Select month and half first'
          }
        >
          <input
            type="date"
            className="ems-input"
            disabled={!shipmentDateRange}
            min={shipmentDateRange?.min}
            max={shipmentDateRange?.max}
            value={data.expectedShipmentDate || ''}
            onChange={(e) => onPatch({ expectedShipmentDate: e.target.value })}
          />
        </Field>
        <Field label="Container No. (later)">
          <input
            className="ems-input"
            value={data.containerNo || ''}
            onChange={(e) => onPatch({ containerNo: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
