// Semantic status colors — intentionally NOT forced to green.
// resolved/completed use green; other statuses keep meaningful colours.
const map: Record<string, string> = {
  reported:    "bg-yellow-50  text-yellow-800  border border-yellow-200",
  pending:     "bg-orange-50  text-orange-800  border border-orange-200",
  in_progress: "bg-blue-50    text-blue-800    border border-blue-200",
  resolved:    "bg-brand-50   text-brand-800   border border-brand-200",
  rejected:    "bg-red-50     text-red-800     border border-red-200",
  closed:      "bg-surface-muted text-ink-muted border border-surface-border",
  assigned:    "bg-yellow-50  text-yellow-800  border border-yellow-200",
  completed:   "bg-brand-50   text-brand-800   border border-brand-200",
  cancelled:   "bg-red-50     text-red-800     border border-red-200",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-surface-muted text-ink-muted border border-surface-border"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
