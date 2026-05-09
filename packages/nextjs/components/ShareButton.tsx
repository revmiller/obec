"use client";

import { useState } from "react";

/// Copies the current page URL to the clipboard. Shows ephemeral confirmation.
export function ShareButton({ label = "Share" }: { label?: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore — older browsers without clipboard API just no-op
    }
  };

  return (
    <button onClick={onClick} className="btn btn-ghost btn-sm gap-2">
      <span aria-hidden>↗</span>
      <span>{copied ? "Link copied" : label}</span>
    </button>
  );
}
