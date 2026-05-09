"use client";

import { ENSName } from "~~/components/ENSName";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "hromada.eth";

export function MemberRow({ node }: { node: `0x${string}` }) {
  const { data: member } = useScaffoldReadContract({
    contractName: "HromadaRegistry",
    functionName: "members",
    args: [node],
  });

  const { data: labels } = useScaffoldReadContract({
    contractName: "HromadaRegistry",
    functionName: "getNodeLabels",
    args: [node],
  });

  if (!member || !member[4]) return null; // not active

  const wallet = member[0] as `0x${string}`;
  const name = labels && labels.length > 0 ? `${[...labels].join(".")}.${PROTOCOL_ROOT}` : member[2];

  return (
    <li className="bg-base-200 rounded-lg p-3">
      <div className="font-mono text-sm">{name}</div>
      <div className="text-xs opacity-60 mt-1">
        <ENSName address={wallet} />
      </div>
    </li>
  );
}
