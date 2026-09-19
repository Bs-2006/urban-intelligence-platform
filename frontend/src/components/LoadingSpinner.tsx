export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
    </div>
  );
}
