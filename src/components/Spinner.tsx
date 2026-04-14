export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 border-[var(--color-warm-200)] border-t-[var(--color-accent-600)] h-5 w-5 ${className}`}
      role="status"
    >
      <span className="sr-only">Loading…</span>
    </div>
  );
}
