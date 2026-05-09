"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";
const ZERO_NODE = `0x${"0".repeat(64)}` as const;

/// When the connected wallet has a member subname, surface a deep-link to their neighborhood.
export function MyMembership() {
  const { address } = useAccount();

  const { data: node } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNodeByAddress",
    args: [address],
  });

  const hasMembership = node && node !== ZERO_NODE;

  const { data: member } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "members",
    args: hasMembership ? [node] : [undefined],
  });

  const { data: neighborhood } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "neighborhoods",
    args: member?.[1] ? [member[1]] : [undefined],
  });

  const { data: labels } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNodeLabels",
    args: hasMembership ? [node] : [undefined],
  });

  if (!address || !hasMembership || !neighborhood) return null;

  const fullName = labels && labels.length > 0 ? `${[...labels].join(".")}.${PROTOCOL_ROOT}` : "";
  const city = neighborhood[0] as string;
  const hood = neighborhood[1] as string;

  return (
    <Link
      href={`/${city}/${hood}`}
      className="block p-4 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/15 transition"
    >
      <div className="text-xs uppercase tracking-wide opacity-70">Welcome back</div>
      <div className="font-mono text-sm mt-1">{fullName}</div>
      <div className="text-sm opacity-70 mt-2">
        Continue to <span className="capitalize font-semibold">{hood}</span>, {city} →
      </div>
    </Link>
  );
}
