export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#E5E5E5] border-t-[#171717] ${className}`}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
