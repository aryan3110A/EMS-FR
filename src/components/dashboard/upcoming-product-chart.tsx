'use client';

type ProductRow = {
  code: string;
  name: string;
  containers: number;
  mt: number;
  contracts: string[];
};

type Props = {
  data: ProductRow[];
  onSelect?: (row: ProductRow) => void;
  selected?: string | null;
};

export function UpcomingProductChart({ data, onSelect, selected }: Props) {
  const max = Math.max(...data.map((d) => d.containers), 1);

  return (
    <div className="space-y-3">
      {data.map((row) => (
        <button
          key={row.code}
          type="button"
          className={`group w-full rounded-lg p-2 text-left transition-colors ${selected === row.code ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}
          onClick={() => onSelect?.(row)}
          title={`Contracts: ${row.contracts.join(', ')}\nMT: ${row.mt}`}
        >
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium">{row.code} — {row.name}</span>
            <span className="text-slate-600">{row.containers} ctr · {row.mt} MT</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(row.containers / max) * 100}%` }}
            />
          </div>
          {selected === row.code && row.contracts.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">Contracts: {row.contracts.join(', ')}</p>
          )}
        </button>
      ))}
      {!data.length && <p className="text-sm text-slate-400">No upcoming data</p>}
    </div>
  );
}
