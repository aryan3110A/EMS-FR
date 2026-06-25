'use client';

import { useMemo } from 'react';
import { Field, ReadOnly } from '@/components/contracts/form-fields';
import { EmsSelect } from '@/components/ui/ems-select';
import { INCOTERM_OPTIONS, CURRENCY_OPTIONS } from '@/lib/contract-labels';
import {
  enrichContainerCommercial,
  commercialFieldVisibility,
  type IncotermType,
} from '@/lib/commercial-calculations';
import { PRODUCT_SPECIFICATIONS } from '@/lib/commercial-calculations';
import { formatNumber } from '@/lib/utils';
import type { ContainerProduct } from '@/lib/api';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ContainerCommercialData = ContainerProduct & {
  containerIndex: number;
  quantityMt?: number;
  incoterm?: IncotermType;
  fobPrice?: number;
  fobCurrency?: string;
  exchangeRate?: number;
  exchangeRateAt?: string;
  exchangeRateSource?: string;
  totalFreight?: number;
  insurance?: number;
  commercialRemarks?: string;
};

type Props = {
  container: ContainerCommercialData;
  onChange: (patch: Partial<ContainerCommercialData>) => void;
  onRefreshRate?: () => void;
  readOnly?: boolean;
  isRefreshing?: boolean;
  showCopyButton?: boolean;
  onCopyFromFirst?: () => void;
};

export function ContainerCommercialSection({
  container,
  onChange,
  onRefreshRate,
  readOnly,
  isRefreshing,
  showCopyButton,
  onCopyFromFirst,
}: Props) {
  const incoterm = (container.incoterm ?? 'FOB') as IncotermType;
  const visibility = commercialFieldVisibility(incoterm);

  const calc = useMemo(
    () =>
      enrichContainerCommercial({
        incoterm,
        fobPrice: container.fobPrice,
        exchangeRate: container.exchangeRate,
        quantityMt: container.quantityMt,
        totalFreight: container.totalFreight,
        insurance: container.insurance,
      }),
    [incoterm, container.fobPrice, container.exchangeRate, container.quantityMt, container.totalFreight, container.insurance],
  );

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-slate-800">Container {container.containerIndex} — Commercial</h4>
        {showCopyButton && onCopyFromFirst && (
          <button type="button" onClick={onCopyFromFirst} className="ems-btn-secondary text-sm">
            Copy details from previous container
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Incoterm">
          <EmsSelect
            value={incoterm}
            onChange={(v) => onChange({ incoterm: v as IncotermType })}
            options={[...INCOTERM_OPTIONS]}
            disabled={readOnly}
          />
        </Field>

        <Field label="Specification">
          <EmsSelect
            value={container.specification ?? ''}
            onChange={(v) => onChange({ specification: v })}
            options={PRODUCT_SPECIFICATIONS.map((s) => ({ value: s, label: s }))}
            placeholder="Select specification"
            disabled={readOnly}
          />
        </Field>

        <Field label="FOB Price">
          <input
            className="ems-input"
            type="number"
            value={container.fobPrice ?? ''}
            disabled={readOnly}
            onChange={(e) => onChange({ fobPrice: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>

        <Field label="FOB Currency">
          <EmsSelect
            value={container.fobCurrency ?? 'USD'}
            onChange={(v) => onChange({ fobCurrency: v })}
            options={[...CURRENCY_OPTIONS]}
            disabled={readOnly}
          />
        </Field>

        <Field label="Exchange Rate">
          <div className="flex gap-2">
            <input
              className="ems-input"
              type="number"
              value={container.exchangeRate ?? ''}
              disabled={readOnly}
              onChange={(e) => onChange({ exchangeRate: e.target.value ? Number(e.target.value) : undefined, exchangeRateSource: 'MANUAL' })}
            />
            {onRefreshRate && !readOnly && (
              <button
                type="button"
                className="ems-btn-secondary shrink-0 p-2.5 flex items-center justify-center"
                onClick={onRefreshRate}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </button>
            )}
          </div>
          {container.exchangeRateAt && (
            <p className="mt-1 text-xs text-slate-500">
              {(!container.exchangeRateSource || container.exchangeRateSource === 'API') ? 'LIVE' : container.exchangeRateSource} · {new Date(container.exchangeRateAt).toLocaleString()}
            </p>
          )}
        </Field>

        <Field label="FOB INR / Kg">
          <ReadOnly value={formatNumber(calc.fobInrPerKg, 2)} />
        </Field>

        {visibility.totalFreight && (
          <Field label="Total Freight for Container">
            <input
              className="ems-input"
              type="number"
              value={container.totalFreight ?? ''}
              disabled={readOnly}
              onChange={(e) => onChange({ totalFreight: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
        )}

        {visibility.freightPerMt && (
          <Field label="Freight per MT">
            <ReadOnly value={formatNumber(calc.freightPerMt, 2)} />
          </Field>
        )}

        {visibility.insurance && (
          <Field label="Insurance">
            <input
              className="ems-input"
              type="number"
              value={container.insurance ?? ''}
              disabled={readOnly}
              onChange={(e) => onChange({ insurance: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
        )}

        {visibility.cifPrice && (
          <Field label="CIF Price">
            <ReadOnly value={formatNumber(calc.cifPrice, 2)} />
          </Field>
        )}

        {visibility.cnfPrice && (
          <Field label="CNF Price">
            <ReadOnly value={formatNumber(calc.cnfPrice, 2)} />
          </Field>
        )}

        <Field label="Commercial Remarks">
          <textarea
            className="ems-input"
            rows={2}
            value={container.commercialRemarks ?? ''}
            disabled={readOnly}
            onChange={(e) => onChange({ commercialRemarks: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
