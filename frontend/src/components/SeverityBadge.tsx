const m: Record<string, string> = {
  low:      "bg-brand-50  text-brand-700  border border-brand-200",
  medium:   "bg-yellow-50 text-yellow-700 border border-yellow-200",
  high:     "bg-orange-50 text-orange-700 border border-orange-200",
  critical: "bg-red-50    text-red-700    border border-red-200",
};

export default function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${m[severity] ?? "bg-surface-muted text-ink-muted border border-surface-border"}`}>
      {severity}
    </span>
  );
}
