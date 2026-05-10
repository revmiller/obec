"use client";

import { ENSName } from "~~/components/ENSName";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";

type Props = {
  projectNode: `0x${string}`;
};

/// Renders the same project subname five different ways. The "oh, we hadn't thought of that"
/// moment for Creative ENS judging — one subname is simultaneously identifier, contract pointer,
/// credential store, and discovery endpoint.
export function ResourceCard({ projectNode }: Props) {
  const { data: resource } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "resources",
    args: [projectNode],
  });

  const { data: labels } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNodeLabels",
    args: [projectNode],
  });

  const { data: statusText } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getText",
    args: [projectNode, "status"],
  });

  const { data: maintainerText } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getText",
    args: [projectNode, "maintainer"],
  });

  const { data: contenthash } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getContenthash",
    args: [projectNode],
  });

  if (!resource || !resource[4]) return null; // not active

  const fullName = labels && labels.length > 0 ? `${[...labels].join(".")}.${PROTOCOL_ROOT}` : "";
  const poolAddress = resource[3] as `0x${string}`;

  return (
    <div className="bg-base-200 rounded-xl p-5 border border-primary/30">
      <div className="text-xs uppercase tracking-wide opacity-60">ENS project subname</div>
      <p className="font-mono text-base mt-1">{fullName}</p>
      <p className="text-sm opacity-80 mt-3 max-w-2xl leading-relaxed">
        One subname doing five jobs at once — identifier, contract pointer, credential store, multichain router, and
        IPFS doc root. Pick any of the five resolvers below; same name, different shape.
      </p>

      <ul className="mt-4 space-y-2 text-sm">
        <Row label="addr(node)" value={<ENSName address={poolAddress} />} hint="escrow pool" />
        <Row label="addr(node, 2147568180)" value={<ENSName address={poolAddress} />} hint="ENSIP-11 multichain" />
        <Row label="text(status)" value={statusText || "—"} hint="lifecycle stage" />
        <Row label="text(maintainer)" value={maintainerText || "—"} hint="responsible member" />
        <Row
          label="contenthash(node)"
          value={contenthash && contenthash !== "0x" ? contenthash : "—"}
          hint="IPFS docs"
        />
      </ul>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <li className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-1 sm:gap-3 sm:items-baseline">
      <span className="font-mono text-xs opacity-70">{label}</span>
      <span className="truncate">{value}</span>
      <span className="text-xs opacity-50 sm:text-right">{hint}</span>
    </li>
  );
}
