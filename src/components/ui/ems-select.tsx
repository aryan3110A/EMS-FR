'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SelectOption = { value: string; label: string };

type EmsSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
};

export function EmsSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchable = false,
  disabled = false,
  className,
}: EmsSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectOption(optValue: string) {
    onChange(optValue);
    setOpen(false);
    setSearch('');
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'ems-select flex w-full items-center justify-between gap-2 text-left',
          open && 'border-blue-500 ring-4 ring-blue-500/10',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className={cn('truncate', !selected?.value && 'font-normal text-slate-400')}>
          {selected?.value ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200',
            open && 'rotate-180 text-blue-500',
          )}
        />
      </button>

      {open && (
        <div className="ems-select-dropdown">
          {searchable && (
            <div className="border-b border-slate-100 bg-slate-50/80 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to search..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  autoFocus
                />
              </div>
            </div>
          )}
          <ul className="max-h-60 overflow-y-auto overscroll-contain p-1.5">
            {filtered.map((opt) => {
              const isSelected = value === opt.value;
              const isPlaceholder = !opt.value;
              return (
                <li key={opt.value || `opt-${opt.label}`}>
                  <button
                    type="button"
                    onClick={() => selectOption(opt.value)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                      isSelected && !isPlaceholder
                        ? 'bg-blue-600 font-medium text-white shadow-sm'
                        : isSelected && isPlaceholder
                          ? 'bg-slate-100 font-normal text-slate-500'
                          : 'text-slate-700 hover:bg-blue-50 hover:text-blue-800',
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && !isPlaceholder && <Check className="h-4 w-4 shrink-0 opacity-90" />}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-slate-400">No matching options</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
