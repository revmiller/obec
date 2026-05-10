"use client";

import { namehash } from "viem/ens";

export function NamehashChip({ name }: { name: string }) {
  const hash = namehash(name);
  return (
    <span
      className="protocol-only mono"
      style={{
        fontSize: 9.5,
        color: "var(--ink-4)",
        display: "inline-block",
        maxWidth: 220,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={hash}
    >
      {hash.slice(0, 12)}…{hash.slice(-6)}
    </span>
  );
}
