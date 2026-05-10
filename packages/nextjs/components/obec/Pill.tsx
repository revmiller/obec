"use client";

import type { CSSProperties, ReactNode } from "react";

type Tone = "default" | "terracotta" | "moss";

export function Pill({
  tone = "default",
  dot,
  children,
  style,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const cls = ["obec-pill"];
  if (tone !== "default") cls.push(tone);
  return (
    <span className={cls.join(" ")} style={style}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}
