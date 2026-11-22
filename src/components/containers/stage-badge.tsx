import { cn } from '@/lib/utils';

const TONE: Record<string, string> = {
  PARTIALLY_FULFILLED: 'bg-amber-50 text-amber-800 border-amber-200',
  FULFILLED: 'bg-orange-50 text-orange-800 border-orange-200',
  CONTAINER_DETAILS_COMPLETED: 'bg-sky-50 text-sky-800 border-sky-200',
  READY_FOR_SAMPLING: 'bg-violet-50 text-violet-800 border-violet-200',
  SAMPLE_SENT: 'bg-violet-50 text-violet-800 border-violet-200',
  AWAITING_SAMPLING_RESULT: 'bg-violet-50 text-violet-800 border-violet-200',
  SAMPLING_RESULT_RECEIVED: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  SAMPLING_PASSED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  SAMPLING_FAILED: 'bg-rose-50 text-rose-800 border-rose-200',
  READY_FOR_DISPATCH: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  DISPATCHED_FROM_FACTORY: 'bg-slate-800 text-white border-slate-800',
  REACHED_PORT: 'bg-slate-700 text-white border-slate-700',
  SHIPPED: 'bg-slate-700 text-white border-slate-700',
  COMPLETED: 'bg-slate-700 text-white border-slate-700',
  ON_HOLD: 'bg-rose-50 text-rose-800 border-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function StageBadge({ stage, label, className }: { stage: string; label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        TONE[stage] || 'bg-slate-50 text-slate-700 border-slate-200',
        className,
      )}
    >
      {label}
    </span>
  );
}
