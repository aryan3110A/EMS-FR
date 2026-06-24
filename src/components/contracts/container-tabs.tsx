'use client';

import { cn } from '@/lib/utils';

type Tab = { index: number; label: string; complete?: boolean };

type Props = {
  tabs: Tab[];
  active: number;
  onChange: (index: number) => void;
};

export function ContainerTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {tabs.map((tab) => (
        <button
          key={tab.index}
          type="button"
          onClick={() => onChange(tab.index)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            active === tab.index
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
          )}
        >
          {tab.label}
          {tab.complete && <span className="ml-1.5 text-xs opacity-80">✓</span>}
        </button>
      ))}
    </div>
  );
}
