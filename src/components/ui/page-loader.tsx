'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function PageSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 py-16">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-blue-400/20" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-blue-100 bg-white shadow-md">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200/80', className)} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ems-card p-5">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-9 w-16" />
          </div>
        ))}
      </div>
      <div className="ems-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="space-y-3 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ContractDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-8 w-48 rounded-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="ems-card p-5">
            <Skeleton className="mb-4 h-5 w-56" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex justify-between gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableRowsSkeleton({ rows = 6, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="py-3">
              <Skeleton className="h-4 w-full max-w-[100px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
