"use client";

export function Meter({
  value,
  total,
  threshold,
  height = 24,
  showLabels = true,
}: {
  value: number;
  total: number;
  threshold?: number;
  height?: number;
  showLabels?: boolean;
}) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  const tPct = threshold !== undefined && total > 0 ? (threshold / total) * 100 : undefined;
  return (
    <div>
      <div className="meter" style={{ height }}>
        <div className="fill" style={{ width: pct + "%" }} />
        {tPct !== undefined && <div className="threshold" style={{ left: tPct + "%" }} />}
      </div>
      {showLabels && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontSize: 10.5,
            fontFamily: "var(--mono)",
            color: "var(--ink-3)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          <span>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>${value.toLocaleString()}</span> committed
          </span>
          <span>of ${total.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
