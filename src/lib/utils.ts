import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d?: string | Date | null) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatNumber(n?: number | null, decimals = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  UNDER_PREPARATION: 'bg-blue-100 text-blue-800',
  AWAITING_SIGNED: 'bg-orange-100 text-orange-800',
  CONFIRMED_FOR_PRODUCTION: 'bg-purple-100 text-purple-800',
  IN_PRODUCTION: 'bg-yellow-100 text-yellow-900',
  READY_FOR_DISPATCH: 'bg-green-100 text-green-800',
  FULLY_DISPATCHED: 'bg-emerald-200 text-emerald-900',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  ON_HOLD: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-200 text-gray-700',
};

export function statusBadge(status: string) {
  return STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-700';
}

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}
