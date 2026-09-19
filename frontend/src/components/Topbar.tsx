export default function Topbar({ title }: { title: string }) {
  return (
    <div className="sticky top-0 z-10 h-14 bg-white border-b border-surface-border flex items-center px-6 justify-between shrink-0 shadow-sm">
      <h1 className="font-semibold text-ink text-base">{title}</h1>
      <span className="text-xs text-ink-subtle font-medium tracking-wide hidden sm:block">
        Urban Intelligence
      </span>
    </div>
  );
}
