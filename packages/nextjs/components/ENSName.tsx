"use client";

import { type Address as AddressType } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "hromada.eth";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/// Render any address as its full ENS subname using the Registry's reverse helpers.
/// Falls back to a truncated 0x… form when the address has no member subname.
export function ENSName({ address }: { address: AddressType | undefined }) {
  const { data: node } = useScaffoldReadContract({
    contractName: "HromadaRegistry",
    functionName: "getNodeByAddress",
    args: [address],
  });

  const hasMembership = node && node !== `0x${"0".repeat(64)}`;

  const { data: labels } = useScaffoldReadContract({
    contractName: "HromadaRegistry",
    functionName: "getNodeLabels",
    args: hasMembership ? [node] : [undefined],
  });

  if (!address || address === ZERO_ADDRESS) {
    return <span className="opacity-50 italic">unassigned</span>;
  }

  if (labels && labels.length > 0) {
    const fullName = `${[...labels].join(".")}.${PROTOCOL_ROOT}`;
    return <span className="font-mono text-sm">{fullName}</span>;
  }

  // Fallback: truncated hex address.
  return (
    <span className="font-mono text-sm opacity-70" title={address}>
      {address.slice(0, 6)}…{address.slice(-4)}
    </span>
  );
}
