'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Buyer } from '@/lib/api';

type Props = {
  value: string;
  buyers: Buyer[];
  onChange: (value: string) => void;
  onSelectBuyer: (name: string) => void;
};

export function BuyerContractSearch({ value, buyers, onChange, onSelectBuyer }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const sorted = [...buyers].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.code?.toLowerCase().includes(q) ?? false),
    );
  }, [buyers, value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={rootRef} className="relative mb-4 max-w-md">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className="ems-search-input"
        placeholder="Search by buyer name..."
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />

      {open && filtered.length > 0 && (
        <ul
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {filtered.map((buyer) => (
            <li key={buyer.id} role="option">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-blue-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelectBuyer(buyer.name);
                  setOpen(false);
                }}
              >
                <span className="font-medium text-slate-800">{buyer.name}</span>
                {buyer.code ? (
                  <span className="shrink-0 text-xs text-slate-400">{buyer.code}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && value.trim() && filtered.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-500 shadow-lg">
          No matching buyers
        </div>
      )}
    </div>
  );
}
