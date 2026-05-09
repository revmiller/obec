"use client";

import Link from "next/link";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";

type Props = {
  node: `0x${string}`;
  city: string;
  neighborhood: string;
};

/// Renders a proposal-typed or resource-typed subname row. Proposal rows link to /p/[proposal].
export function ResourceRow({ node, city, neighborhood }: Props) {
  const { data: resource } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "resources",
    args: [node],
  });

  if (!resource || !resource[4]) return null; // not active

  const label = resource[1] as string;
  const type = resource[2] as string;
  const isProposal = type === "proposal";
  const fullName = `${label}.${neighborhood}.${city}.${PROTOCOL_ROOT}`;

  const inner = (
    <div className="bg-base-200 hover:bg-base-300 transition rounded-lg p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-sm">{label}</span>
        <span className="text-xs uppercase tracking-wide opacity-60">{type}</span>
      </div>
      <div className="text-xs opacity-60 mt-1">{fullName}</div>
    </div>
  );

  return isProposal ? (
    <li>
      <Link href={`/${city}/${neighborhood}/p/${label}`} className="block">
        {inner}
      </Link>
    </li>
  ) : (
    <li>{inner}</li>
  );
}
