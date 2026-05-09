"use client";

import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";
const ZERO_NODE = `0x${"0".repeat(64)}` as const;

/// Compact pill showing the connected wallet's full ENS subname when it's a member,
/// or nothing otherwise (the connect button shows the address fallback).
export function ConnectedAs() {
  const { address } = useAccount();

  const { data: node } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNodeByAddress",
    args: [address],
  });

  const hasMembership = node && node !== ZERO_NODE;

  const { data: labels } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNodeLabels",
    args: hasMembership ? [node] : [undefined],
  });

  if (!address || !hasMembership || !labels || labels.length === 0) return null;

  const fullName = `${[...labels].join(".")}.${PROTOCOL_ROOT}`;

  return (
    <span className="hidden md:inline-block text-xs font-mono px-2 py-1 rounded-full bg-primary/15 text-primary mr-2">
      {fullName}
    </span>
  );
}
