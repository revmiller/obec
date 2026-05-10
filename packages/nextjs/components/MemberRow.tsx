"use client";

import { Avatar } from "~~/components/obec";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";

export function MemberRow({ node }: { node: `0x${string}` }) {
  const { data: member } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "members",
    args: [node],
  });

  const { data: labels } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNodeLabels",
    args: [node],
  });

  if (!member || !Array.isArray(member) || !member[4]) return null;

  const wallet = member[0] as `0x${string}`;
  const handle = Array.isArray(labels) && labels.length > 0 ? labels[0] : (member[2] as string);
  const parentPath = Array.isArray(labels) && labels.length > 1 ? labels.slice(1).join(".") : PROTOCOL_ROOT;

  return (
    <a
      className="block py-0.5"
      title={`${wallet} — ${handle}.${parentPath}`}
      style={{ textDecoration: "none", color: "inherit", cursor: "default" }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Avatar handle={handle} size="sm" />
        <span style={{ fontSize: 14 }}>{handle}</span>
        <span className="meta" style={{ color: "var(--ink-3)", fontSize: 12, marginLeft: 4 }}>
          {wallet.slice(0, 6)}…{wallet.slice(-4)}
        </span>
      </span>
    </a>
  );
}
