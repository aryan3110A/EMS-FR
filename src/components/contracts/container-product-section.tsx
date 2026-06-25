'use client';

import { Field, ReadOnly } from '@/components/contracts/form-fields';
import { EmsSelect } from '@/components/ui/ems-select';
import { InlineAddPanel } from '@/components/ui/inline-add-panel';
import { ADD_OPTION_VALUE } from '@/lib/form-constants';
import { PRODUCT_SPECIFICATIONS } from '@/lib/commercial-calculations';
import type { ContainerProduct, Product } from '@/lib/api';

type AddPanel = 'product' | 'variant' | null;

type ContainerProductSectionProps = {
  index: number;
  data: ContainerProduct;
  products: Product[];
  showCopyButton: boolean;
  onCopyFromFirst: () => void;
  onChange: (field: keyof ContainerProduct, value: string) => void;
  onPatch: (patch: Partial<ContainerProduct>) => void;
  addPanel: AddPanel;
  isAddTarget: boolean;
  onOpenAddProduct: () => void;
  onOpenAddVariant: () => void;
  onCloseAddPanel: () => void;
  onProductCreated: (product: Product) => void;
  onVariantCreated: (product: Product, variantName: string) => void;
  createProduct: (name: string) => Promise<Product>;
  createVariant: (productId: string, name: string, processingType?: string) => Promise<Product>;
  hideBorder?: boolean;
};

function processingOptionsFor(product: Product | undefined) {
  if (!product?.variants?.length) return [];
  const types = product.variants.map((v) => v.processingType || v.name).filter(Boolean);
  return [...new Set(types)] as string[];
}

export function ContainerProductSection({
  index,
  data,
  products,
  showCopyButton,
  onCopyFromFirst,
  onChange,
  onPatch,
  addPanel,
  isAddTarget,
  onOpenAddProduct,
  onOpenAddVariant,
  onCloseAddPanel,
  onProductCreated,
  onVariantCreated,
  createProduct,
  createVariant,
  hideBorder,
}: ContainerProductSectionProps) {
  const selectedProduct = products.find((p) => p.id === data.productId);
  const processingOptions = processingOptionsFor(selectedProduct);

  return (
    <div className={index > 0 && !hideBorder ? 'mt-8 border-t border-slate-200 pt-8' : ''}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-800">Container {index + 1}</h3>
        {showCopyButton && (
          <button type="button" onClick={onCopyFromFirst} className="ems-btn-secondary text-sm">
            Same as Container 1
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product Name" className="sm:col-span-2">
          <EmsSelect
            searchable
            value={data.productId}
            onChange={(v) => {
              const product = products.find((p) => p.id === v);
              onPatch({
                productId: v,
                productVariantId: '',
                processingType: '',
                ...(product?.defaultSpecification ? { specification: product.defaultSpecification } : {}),
              });
            }}
            placeholder="Select product"
            addOptionValue={ADD_OPTION_VALUE}
            onAddSelect={onOpenAddProduct}
            options={[
              { value: '', label: 'Select product' },
              ...products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
              { value: ADD_OPTION_VALUE, label: '+ Add new Product' },
            ]}
          />
          {addPanel === 'product' && isAddTarget && (
            <InlineAddPanel
              title="Add product"
              fields={[{ key: 'name', label: 'Product name', placeholder: 'e.g. Cumin Seeds' }]}
              onCancel={onCloseAddPanel}
              onSave={async (values) => {
                const product = await createProduct(values.name);
                onProductCreated(product);
                onCloseAddPanel();
              }}
            />
          )}
        </Field>

        <Field label="Product Variant">
          <EmsSelect
            value={data.productVariantId || ''}
            onChange={(v) => {
              const variant = selectedProduct?.variants?.find((x) => x.id === v);
              onChange('productVariantId', v);
              if (variant?.processingType) onChange('processingType', variant.processingType);
            }}
            placeholder="Select variant"
            disabled={!data.productId}
            addOptionValue={ADD_OPTION_VALUE}
            onAddSelect={onOpenAddVariant}
            options={[
              { value: '', label: 'Select variant' },
              ...(selectedProduct?.variants?.map((v) => ({ value: v.id, label: v.name })) ?? []),
              ...(data.productId ? [{ value: ADD_OPTION_VALUE, label: '+ Add new Product variant' }] : []),
            ]}
          />
          {addPanel === 'variant' && isAddTarget && data.productId && (
            <InlineAddPanel
              title="Add product variant"
              fields={[
                { key: 'name', label: 'Variant name', placeholder: 'e.g. Toasted' },
                { key: 'processingType', label: 'Processing type', placeholder: 'Optional' },
              ]}
              onCancel={onCloseAddPanel}
              onSave={async (values) => {
                const product = await createVariant(data.productId, values.name, values.processingType || values.name);
                onVariantCreated(product, values.name);
                onCloseAddPanel();
              }}
            />
          )}
        </Field>

        <Field label="Processing Type">
          <EmsSelect
            value={data.processingType || ''}
            onChange={(v) => onChange('processingType', v)}
            placeholder="Select processing"
            options={[
              { value: '', label: 'Select processing' },
              ...processingOptions.map((t) => ({ value: t, label: t })),
            ]}
          />
        </Field>

        <Field label="Quantity Unit">
          <ReadOnly value="Metric Tons (MT)" />
        </Field>

        <Field label="Product Specification" className="sm:col-span-2">
          <EmsSelect
            value={data.specification || ''}
            onChange={(v) => onChange('specification', v)}
            placeholder="Select specification"
            options={[
              { value: '', label: 'Select specification' },
              ...PRODUCT_SPECIFICATIONS.map((s) => ({ value: s, label: s })),
            ]}
          />
        </Field>

        <Field label="Product Remarks" className="sm:col-span-2">
          <textarea
            className="ems-input min-h-[72px]"
            value={data.productRemarks || ''}
            onChange={(e) => onChange('productRemarks', e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}
