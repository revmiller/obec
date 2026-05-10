"use client";

type Size = "sm" | "md" | "lg";

export function Avatar({ handle, size = "md" }: { handle: string; size?: Size }) {
  const cls = size === "lg" ? "obec-avatar lg" : size === "sm" ? "obec-avatar sm" : "obec-avatar";
  const h = Array.from(handle || "?").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  const hue = Math.abs(h) % 360;
  const bg = `oklch(0.92 0.02 ${hue})`;
  const initial = (handle || "?")[0];
  return (
    <span className={cls} style={{ background: bg }}>
      {initial}
    </span>
  );
}
