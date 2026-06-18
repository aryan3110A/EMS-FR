'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  addOptionValue?: string;
  onAddSelect?: () => void;
};

type DropdownPos = { top: number; left: number; width: number; maxHeight: number; openUp: boolean };

export function EmsSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchable = false,
  disabled = false,
  className,
  addOptionValue,
  onAddSelect,
}: EmsSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const preferredMax = searchable ? 320 : 240;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(preferredMax, openUp ? spaceAbove : spaceBelow);

    setPos({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(maxHeight, 120),
      openUp,
    });
  }, [searchable]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if ((target as Element).closest?.('.ems-select-portal')) return;
      setOpen(false);
      setSearch('');
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectOption(optValue: string) {
    if (addOptionValue && optValue === addOptionValue && onAddSelect) {
      onAddSelect();
      setOpen(false);
      setSearch('');
      return;
    }
    onChange(optValue);
    setOpen(false);
    setSearch('');
  }

  function toggleOpen() {
    if (disabled) return;
    setOpen((o) => {
      if (!o) updatePosition();
      return !o;
    });
  }

  const dropdown =
    open && pos && mounted
      ? createPortal(
          <div
            className="ems-select-dropdown ems-select-portal fixed z-[9999]"
            style={{
              left: pos.left,
              width: pos.width,
              top: pos.openUp ? undefined : pos.top,
              bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
              maxHeight: pos.maxHeight,
            }}
          >
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
            <ul
              className="overflow-y-auto overscroll-contain p-1.5"
              style={{ maxHeight: searchable ? pos.maxHeight - 56 : pos.maxHeight - 8 }}
            >
              {filtered.map((opt) => {
                const isSelected = value === opt.value;
                const isPlaceholder = !opt.value;
                const isAddOption = addOptionValue && opt.value === addOptionValue;
                return (
                  <li key={opt.value || `opt-${opt.label}`} className={isAddOption ? 'border-t border-slate-100 mt-1 pt-1' : undefined}>
                    <button
                      type="button"
                      onClick={() => selectOption(opt.value)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                        isAddOption && 'font-medium text-blue-700 hover:bg-blue-50',
                        isSelected && !isPlaceholder && !isAddOption
                          ? 'bg-blue-600 font-medium text-white shadow-sm'
                          : isSelected && isPlaceholder
                            ? 'bg-slate-100 font-normal text-slate-500'
                            : !isAddOption && 'text-slate-700 hover:bg-blue-50 hover:text-blue-800',
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
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
      {dropdown}
    </div>
  );
}
