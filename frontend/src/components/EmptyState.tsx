export default function EmptyState({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-14 text-center border border-dashed border-surface-border rounded-xl bg-surface-subtle">
      <div className="w-10 h-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center mb-3">
        <span className="text-brand text-lg">—</span>
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {desc && <p className="text-sm text-ink-muted mt-1 max-w-xs">{desc}</p>}
    </div>
  );
}
