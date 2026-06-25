'use client';

import Link from 'next/link';

type ShippedProductRow = {
  code: string;
  name: string;
  quantity: number;
  containers: number;
  contracts: string[];
  contractMap?: Record<string, string>;
};

type Props = {
  data: ShippedProductRow[];
  onSelect?: (row: ShippedProductRow) => void;
  selected?: string | null;
};

export function ShippedProductChart({ data, onSelect, selected }: Props) {
  const max = Math.max(...data.map((d) => d.quantity), 1);

  return (
    <div className="space-y-4">
      {data.map((row) => (
        <div
          key={row.code}
          className={`relative rounded-lg p-3 border border-slate-100 transition-all ${
            selected === row.code ? 'bg-indigo-50/50 border-indigo-200' : 'hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-left font-medium text-slate-800 focus:outline-none hover:text-indigo-600"
              onClick={() => onSelect?.(row)}
            >
              {row.code} — {row.name}
            </button>
            <span className="text-sm font-semibold text-slate-600">
              {row.quantity.toFixed(2)} MT · {row.containers} ctr
            </span>
          </div>

          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${(row.quantity / max) * 100}%` }}
            />
          </div>

          {/* Detailed Info Card on Selection/Hover */}
          <div className="mt-3 text-xs text-slate-500 space-y-1 bg-slate-50 border border-slate-100 rounded p-2">
            <p><span className="font-medium text-slate-700">Shipped Qty:</span> {row.quantity.toFixed(2)} MT</p>
            <p><span className="font-medium text-slate-700">Containers:</span> {row.containers}</p>
            {row.contracts.length > 0 && (
              <div>
                <span className="font-medium text-slate-700">Contributing Contracts: </span>
                <span className="inline-flex flex-wrap gap-1">
                  {row.contracts.map((cNum) => {
                    const cId = row.contractMap?.[cNum];
                    return cId ? (
                      <Link
                        key={cNum}
                        href={`/contracts/${cId}`}
                        className="text-indigo-600 font-semibold hover:underline"
                      >
                        {cNum}
                      </Link>
                    ) : (
                      <span key={cNum}>{cNum}</span>
                    );
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
      {!data.length && <p className="text-sm text-slate-400">No shipped data found for this selection.</p>}
    </div>
  );
}
