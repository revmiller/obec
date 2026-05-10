const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";

export const Footer = () => {
  return (
    <footer
      className="flex justify-between items-center px-6 sm:px-10 py-9 bg-[var(--paper)]"
      style={{ borderTop: "1px solid var(--hair)" }}
    >
      <span
        className="serif"
        style={{ fontSize: 16, fontWeight: 400, letterSpacing: "-0.03em", color: "var(--ink-3)" }}
      >
        obec
      </span>
      <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
        {PROTOCOL_ROOT}
      </span>
    </footer>
  );
};
