'use client';

import { Field } from '@/components/contracts/form-fields';
import { EmsSelect } from '@/components/ui/ems-select';
import type { ContainerProduct, PackagingType } from '@/lib/api';
import { ADD_OPTION_VALUE, PACKING_SIZE_UNITS } from '@/lib/form-constants';

type Props = {
  index: number;
  data: ContainerProduct;
  packaging: PackagingType[];
  showCopyButton: boolean;
  onCopyFromFirst: () => void;
  onPatch: (patch: Partial<ContainerProduct>) => void;
  onAddPackaging?: () => void;
  hideBorder?: boolean;
};

export function ContainerPackagingSection({
  index,
  data,
  packaging,
  showCopyButton,
  onCopyFromFirst,
  onPatch,
  onAddPackaging,
  hideBorder,
}: Props) {
  const sizesForType = packaging.find((p) => p.id === data.packagingTypeId)?.sizes ?? packaging.flatMap((p) => p.sizes || []);

  return (
    <div className={index > 0 && !hideBorder ? 'mt-8 border-t border-slate-200 pt-8' : ''}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-800">Container {index + 1} — Packaging</h3>
        {showCopyButton && (
          <button type="button" onClick={onCopyFromFirst} className="ems-btn-secondary text-sm">
            Copy from previous container
          </button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Packing Material">
          <EmsSelect
            value={data.packagingTypeId || ''}
            onChange={(v) => {
              if (v === ADD_OPTION_VALUE) {
                onAddPackaging?.();
                return;
              }
              onPatch({ packagingTypeId: v, packagingSizeId: '', packingDescription: '' });
            }}
            placeholder="Select type"
            addOptionValue={onAddPackaging ? ADD_OPTION_VALUE : undefined}
            onAddSelect={onAddPackaging}
            options={[
              { value: '', label: 'Select type' },
              ...packaging.map((p) => ({ value: p.id, label: p.name })),
              ...(onAddPackaging ? [{ value: ADD_OPTION_VALUE, label: '+ Add packaging material' }] : []),
            ]}
          />
        </Field>
        <Field label="Preset Packing Size">
          <EmsSelect
            value={data.packagingSizeId || ''}
            onChange={(v) => {
              const size = sizesForType.find((s) => s.id === v);
              onPatch({
                packagingSizeId: v,
                packingDescription: size?.label,
                packingSizeValue: size?.weightKg,
                packingSizeUnit: size?.weightUnit || 'KG',
              });
            }}
            placeholder="Select preset"
            options={[
              { value: '', label: 'Select preset' },
              ...sizesForType.map((s) => ({ value: s.id, label: s.label })),
            ]}
          />
        </Field>
        <Field label="Custom Size Value">
          <input
            type="number"
            className="ems-input"
            value={data.packingSizeValue ?? ''}
            onChange={(e) => onPatch({ packingSizeValue: parseFloat(e.target.value) || undefined })}
          />
        </Field>
        <Field label="Size Unit">
          <EmsSelect
            value={data.packingSizeUnit || 'KG'}
            onChange={(v) => onPatch({ packingSizeUnit: v })}
            options={PACKING_SIZE_UNITS.map((u) => ({ value: u.value, label: u.label }))}
          />
        </Field>
        <Field label="Packing Description" className="sm:col-span-2">
          <input
            className="ems-input"
            value={data.packingDescription || ''}
            onChange={(e) => onPatch({ packingDescription: e.target.value })}
            placeholder="Auto-filled from preset or enter manually"
          />
        </Field>
      </div>
    </div>
  );
}
