"use client";

import { useNeighborhoodAggregates } from "~~/hooks/useNeighborhoodAggregates";

const cell = {
  padding: "28px 32px",
} as const;

function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${n.toLocaleString()}`;
}

export function NeighborhoodStats({
  neighborhoodId,
  memberCount,
}: {
  neighborhoodId: `0x${string}`;
  memberCount: number;
}) {
  const { pooledUsd, activeDriveCount, proposalCount, isLoading } = useNeighborhoodAggregates(neighborhoodId);

  const items = [
    { n: String(memberCount), l: "members", sub: "subnames issued" },
    { n: String(proposalCount), l: "pools", sub: "across this neighborhood" },
    { n: isLoading ? "…" : fmtUsd(pooledUsd), l: "pooled", sub: "USDC across pools" },
    { n: isLoading ? "…" : String(activeDriveCount), l: "active drives", sub: "fundraising or executing" },
  ];

  return (
    <section
      className="grid grid-cols-2 lg:grid-cols-4"
      style={{ borderTop: "1px solid var(--hair)", borderBottom: "1px solid var(--hair)" }}
    >
      {items.map((s, i, arr) => (
        <div
          key={s.l}
          style={{
            ...cell,
            borderRight: i < arr.length - 1 ? "1px solid var(--hair)" : "none",
          }}
        >
          <div className="serif num" style={{ fontSize: 42, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.03em" }}>
            {s.n}
          </div>
          <div className="micro" style={{ marginTop: 10, fontSize: 11 }}>
            {s.l}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 6 }}>{s.sub}</div>
        </div>
      ))}
    </section>
  );
}
