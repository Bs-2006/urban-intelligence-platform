import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, totalItems, pageSize, onChange }: Props) {
  if (totalPages <= 1 && totalItems <= pageSize) return null;

  const pageNumbers = (): (number | "…")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const nums: (number | "…")[] = [1];
    const lo = Math.max(2, page - 2);
    const hi = Math.min(totalPages - 1, page + 2);
    if (lo > 2) nums.push("…");
    for (let p = lo; p <= hi; p++) nums.push(p);
    if (hi < totalPages - 1) nums.push("…");
    nums.push(totalPages);
    return nums;
  };

  const base     = "inline-flex items-center justify-center h-9 min-w-[36px] px-3 rounded-lg border text-sm font-medium transition-colors";
  const active   = "bg-brand text-white border-brand";
  const normal   = "bg-white text-ink border-surface-border hover:bg-surface-subtle hover:border-brand-300";
  const disabled = "opacity-40 cursor-not-allowed pointer-events-none";

  return (
    <div className="flex items-center justify-center gap-1 flex-wrap py-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className={`${base} gap-1 ${page === 1 ? disabled + " " + normal : normal}`}
      >
        <ChevronLeft size={14} /> Previous
      </button>

      {pageNumbers().map((p, i) =>
        p === "…" ? (
          <span key={`e-${i}`} className="w-9 text-center text-ink-subtle text-sm select-none">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`${base} ${page === p ? active : normal}`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className={`${base} gap-1 ${page === totalPages ? disabled + " " + normal : normal}`}
      >
        Next <ChevronRight size={14} />
      </button>
    </div>
  );
}
