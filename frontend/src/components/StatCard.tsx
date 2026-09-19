interface Props {
  title: string;
  value: any;
  icon?: React.ReactNode;
  accent?: string;
}

// h-full so sibling cards in the same grid row are equal height via items-stretch
export default function StatCard({ title, value, icon, accent }: Props) {
  return (
    <div className="h-full bg-white rounded-xl border border-surface-border p-5 shadow-sm flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-muted leading-snug">{title}</p>
        {icon && (
          <div className={`p-2 rounded-lg shrink-0 ${accent ?? "bg-brand-50 text-brand"}`}>
            {icon}
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-ink mt-3 leading-none">{value}</p>
    </div>
  );
}
