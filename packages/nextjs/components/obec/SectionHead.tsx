"use client";

import type { ReactNode } from "react";

export function SectionHead({ num, children, right }: { num?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="section-head" style={{ alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <span style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        {num && <span className="num-tag">§ {num}</span>}
        <h2 className="serif" style={{ margin: 0 }}>
          {children}
        </h2>
      </span>
      {right}
    </div>
  );
}
