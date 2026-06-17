'use client';

import { cn } from '@/lib/utils';

export function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={className}>
      <label className="ems-label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ReadOnly({ value, placeholder = '—' }: { value?: string | number | null; placeholder?: string }) {
  return (
    <div className="ems-input bg-slate-50 text-slate-600 cursor-default">
      {value !== null && value !== undefined && value !== '' ? value : placeholder}
    </div>
  );
}

export function SectionBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-3 text-sm text-blue-900">
      {children}
    </div>
  );
}

export function StepPills({
  steps,
  current,
  onStepClick,
}: {
  steps: string[];
  current: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {steps.map((s, i) => {
        const isActive = i === current;
        const isCompleted = i < current;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onStepClick?.(i)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
              onStepClick && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
              isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : isCompleted
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700',
            )}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

export const ON_BEHALF_OPTIONS = [
  'Own Company',
  'Export Agent',
  'Trading Representative',
  'Other',
];

export const CONTRACT_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'UNDER_PREPARATION', label: 'Under Preparation' },
  { value: 'CONTRACT_SENT', label: 'Contract Sent to Buyer' },
  { value: 'AWAITING_SIGNED', label: 'Awaiting Signed Contract' },
  { value: 'SIGNED_RECEIVED', label: 'Signed Contract Received' },
];

export function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h4 className="mb-4 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-blue-700">
        {title}
      </h4>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

export function ReviewField({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | number | null;
  className?: string;
}) {
  const display = value !== null && value !== undefined && String(value).trim() !== '' ? String(value) : '—';
  return (
    <div className={className}>
      <dt className="ems-label mb-1.5">{label}</dt>
      <dd className="min-h-[2.5rem] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium leading-relaxed text-slate-800 break-words">
        {display}
      </dd>
    </div>
  );
}
