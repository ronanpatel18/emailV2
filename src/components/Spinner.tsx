export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`spin ${className}`}
      role="status"
      style={{
        display: "inline-block",
        width: 18,
        height: 18,
        borderRadius: "50%",
        border: "2px solid var(--line-2)",
        borderTopColor: "var(--ink)",
      }}
    >
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>Loading…</span>
    </div>
  );
}
