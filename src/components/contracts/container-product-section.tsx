'use client';

import { Field } from '@/components/contracts/form-fields';
import { FieldError } from '@/components/contracts/field-error';
import { EmsSelect } from '@/components/ui/ems-select';
import { InlineAddPanel } from '@/components/ui/inline-add-panel';
import { ADD_OPTION_VALUE } from '@/lib/form-constants';
import { PRODUCT_SPECIFICATIONS } from '@/lib/commercial-calculations';
import type { ContainerProduct, ContainerProductLine, Product } from '@/lib/api';
import { roundMt } from '@/lib/contract-validation';
import { showInfo } from '@/lib/toast';
import { Plus, Trash2 } from 'lucide-react';

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
  errors?: Record<string, string>;
};

function emptyLine(quantityMt = 0): ContainerProductLine {
  return {
    productIndex: 1,
    productId: '',
    productVariantId: '',
    processingType: '',
    specification: '',
    quantityMt,
    productRemarks: '',
  };
}

function linesFromData(data: ContainerProduct): ContainerProductLine[] {
  if (data.products?.length) return data.products;
  if (data.productId) {
    return [
      {
        productIndex: 1,
        productId: data.productId,
        productVariantId: data.productVariantId,
        processingType: data.processingType,
        specification: data.specification,
        quantityMt: data.quantityMt ?? 0,
        packagingTypeId: data.packagingTypeId,
        packagingSizeId: data.packagingSizeId,
        packingDescription: data.packingDescription,
        productRemarks: data.productRemarks,
      },
    ];
  }
  return [emptyLine(data.quantityMt ?? 0)];
}

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
  errors = {},
}: ContainerProductSectionProps) {
  const lines = linesFromData(data);
  const productSum = lines.reduce((s, p) => s + (p.quantityMt || 0), 0);
  const containerMt = data.quantityMt ?? 0;

  function commitLines(next: ContainerProductLine[]) {
    const normalized = next.map((p, i) => ({ ...p, productIndex: i + 1 }));
    const primary = normalized[0];
    onPatch({
      products: normalized,
      productId: primary?.productId || '',
      productVariantId: primary?.productVariantId,
      processingType: primary?.processingType,
      specification: primary?.specification,
      productRemarks: primary?.productRemarks,
      packagingTypeId: primary?.packagingTypeId,
      packagingSizeId: primary?.packagingSizeId,
      packingDescription: primary?.packingDescription,
    });
  }

  function updateLine(rowIdx: number, patch: Partial<ContainerProductLine>) {
    const next = lines.map((l, i) => (i === rowIdx ? { ...l, ...patch } : l));
    commitLines(next);
  }

  function addProductRow() {
    const remaining = Math.max(0, roundMt(containerMt - productSum));
    commitLines([...lines, emptyLine(remaining || 0)]);
  }

  function removeProductRow(rowIdx: number) {
    if (lines.length <= 1) return;
    commitLines(lines.filter((_, i) => i !== rowIdx));
  }

  function handleCopy() {
    onCopyFromFirst();
    showInfo(`Copied product rows from previous container to Container ${index + 1}`);
  }

  return (
    <div className={index > 0 && !hideBorder ? 'mt-8 border-t border-slate-200 pt-8' : ''}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-800">Container {index + 1} — Products</h3>
          <p className={`mt-1 text-sm ${Math.abs(productSum - containerMt) < 0.001 ? 'text-green-700' : 'text-red-600'}`}>
            Products total: {productSum.toFixed(3)} MT / Container: {containerMt} MT
          </p>
          <FieldError message={errors[`container_${index}_products`]} />
        </div>
        <div className="flex flex-wrap gap-2">
          {showCopyButton && (
            <button type="button" onClick={handleCopy} className="ems-btn-secondary text-sm">
              Copy details from previous container
            </button>
          )}
          <button type="button" onClick={addProductRow} className="ems-btn-primary gap-1 text-sm">
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {lines.map((line, rowIdx) => {
        const selectedProduct = products.find((p) => p.id === line.productId);
        const processingOptions = processingOptionsFor(selectedProduct);
        return (
          <div
            key={rowIdx}
            className={`mb-6 rounded-xl border border-slate-200 bg-slate-50/50 p-4 ${rowIdx > 0 ? 'mt-4' : ''}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700">Product {rowIdx + 1}</h4>
              {lines.length > 1 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
                  onClick={() => removeProductRow(rowIdx)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product Name" className="sm:col-span-2">
                <EmsSelect
                  searchable
                  value={line.productId}
                  onChange={(v) => {
                    if (v === ADD_OPTION_VALUE) {
                      onOpenAddProduct();
                      return;
                    }
                    const product = products.find((p) => p.id === v);
                    updateLine(rowIdx, {
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
                {addPanel === 'product' && isAddTarget && rowIdx === 0 && (
                  <InlineAddPanel
                    title="Add product"
                    fields={[{ key: 'name', label: 'Product name', placeholder: 'e.g. Cumin Seeds' }]}
                    onCancel={onCloseAddPanel}
                    onSave={async (values) => {
                      const product = await createProduct(values.name);
                      onProductCreated(product);
                      updateLine(rowIdx, {
                        productId: product.id,
                        specification: product.defaultSpecification || '',
                      });
                      onCloseAddPanel();
                    }}
                  />
                )}
                <FieldError message={errors[`container_${index}_product_${rowIdx}`]} />
              </Field>

              <Field label="Product Quantity / MT">
                <input
                  type="number"
                  step="0.001"
                  min={0.001}
                  className="ems-input"
                  value={line.quantityMt ?? ''}
                  onChange={(e) => updateLine(rowIdx, { quantityMt: roundMt(parseFloat(e.target.value) || 0) })}
                />
              </Field>

              <Field label="Processing / Variant">
                <EmsSelect
                  value={line.processingType || line.productVariantId || ''}
                  onChange={(v) => {
                    if (v === ADD_OPTION_VALUE) {
                      onOpenAddVariant();
                      return;
                    }
                    const variant = selectedProduct?.variants?.find(
                      (x) => x.id === v || x.processingType === v || x.name === v,
                    );
                    updateLine(rowIdx, {
                      processingType: variant?.processingType || variant?.name || v,
                      productVariantId: variant?.id || '',
                    });
                  }}
                  placeholder="Select processing"
                  addOptionValue={line.productId ? ADD_OPTION_VALUE : undefined}
                  onAddSelect={onOpenAddVariant}
                  options={[
                    { value: '', label: 'Select' },
                    ...processingOptions.map((t) => ({ value: t, label: t })),
                    ...(line.productId ? [{ value: ADD_OPTION_VALUE, label: '+ Add new Product variant' }] : []),
                  ]}
                />
                {addPanel === 'variant' && isAddTarget && line.productId && (
                  <InlineAddPanel
                    title="Add variant"
                    fields={[
                      { key: 'name', label: 'Variant / processing name', placeholder: 'e.g. Sortex' },
                    ]}
                    onCancel={onCloseAddPanel}
                    onSave={async (values) => {
                      const product = await createVariant(line.productId, values.name, values.name);
                      onVariantCreated(product, values.name);
                      updateLine(rowIdx, { processingType: values.name });
                      onCloseAddPanel();
                    }}
                  />
                )}
              </Field>

              <Field label="Specification" className="sm:col-span-2">
                <EmsSelect
                  value={line.specification || ''}
                  onChange={(v) => updateLine(rowIdx, { specification: v })}
                  options={[
                    { value: '', label: 'Select specification' },
                    ...PRODUCT_SPECIFICATIONS.map((s) => ({ value: s, label: s })),
                  ]}
                />
                <FieldError message={errors[`container_${index}_spec_${rowIdx}`]} />
              </Field>

              <Field label="Product Remarks" className="sm:col-span-2">
                <textarea
                  className="ems-input min-h-[60px]"
                  value={line.productRemarks || ''}
                  onChange={(e) => updateLine(rowIdx, { productRemarks: e.target.value })}
                />
              </Field>
            </div>
          </div>
        );
      })}
    </div>
  );
}
