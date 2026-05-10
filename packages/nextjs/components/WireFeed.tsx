"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { ENSName } from "~~/components/obec";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

type WireEvent = {
  key: string;
  blockNumber: bigint;
  logIndex: number;
  kind:
    | "joined"
    | "registered"
    | "committed"
    | "milestone"
    | "attested"
    | "withdrawn"
    | "refunded"
    | "expired"
    | "disputed";
  proposalNode?: `0x${string}`;
  args: Record<string, unknown>;
};

function fmtUsdc(raw: bigint): string {
  const n = Number(formatUnits(raw, USDC_DECIMALS));
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k USDC` : `${n.toLocaleString()} USDC`;
}

function shortNode(node: `0x${string}` | undefined): string {
  if (!node) return "—";
  return `${node.slice(0, 6)}…${node.slice(-4)}`;
}

/**
 * Live activity feed for a single neighborhood. Reads recent on-chain events
 * directly via getLogs (per useScaffoldEventHistory). Pool events are filtered
 * to those whose proposalNode is a registered resource on this neighborhood.
 */
export function WireFeed({
  neighborhoodId,
  projectNodes,
  city,
  neighborhood,
  limit = 8,
}: {
  neighborhoodId: `0x${string}`;
  projectNodes: readonly `0x${string}`[];
  city: string;
  neighborhood: string;
  limit?: number;
}) {
  const { data: joinedEvents } = useScaffoldEventHistory({
    contractName: "ObecRegistry",
    eventName: "MemberJoined",
    fromBlock: undefined,
    filters: { neighborhoodId },
    watch: true,
  });
  const { data: registeredEvents } = useScaffoldEventHistory({
    contractName: "ObecRegistry",
    eventName: "ResourceRegistered",
    fromBlock: undefined,
    filters: { neighborhoodId },
    watch: true,
  });
  const { data: committedEvents } = useScaffoldEventHistory({
    contractName: "CommitmentPool",
    eventName: "Committed",
    fromBlock: undefined,
    watch: true,
  });
  const { data: milestoneEvents } = useScaffoldEventHistory({
    contractName: "CommitmentPool",
    eventName: "MilestoneReleased",
    fromBlock: undefined,
    watch: true,
  });
  const { data: attestedEvents } = useScaffoldEventHistory({
    contractName: "CommitmentPool",
    eventName: "Attested",
    fromBlock: undefined,
    watch: true,
  });
  const { data: refundedEvents } = useScaffoldEventHistory({
    contractName: "CommitmentPool",
    eventName: "Refunded",
    fromBlock: undefined,
    watch: true,
  });

  const nodeSet = useMemo(() => new Set<string>(projectNodes.map(n => n.toLowerCase())), [projectNodes]);

  const items = useMemo<WireEvent[]>(() => {
    const out: WireEvent[] = [];
    const push = (kind: WireEvent["kind"], events: any[] | undefined, scoped: boolean) => {
      if (!events) return;
      for (const e of events) {
        const node = e.args?.proposalNode as `0x${string}` | undefined;
        if (scoped && node && !nodeSet.has(node.toLowerCase())) continue;
        out.push({
          key: `${e.transactionHash}-${e.logIndex}`,
          blockNumber: BigInt(e.blockNumber ?? 0),
          logIndex: Number(e.logIndex ?? 0),
          kind,
          proposalNode: node,
          args: e.args ?? {},
        });
      }
    };
    push("joined", joinedEvents, false);
    push("registered", registeredEvents, false);
    push("committed", committedEvents, true);
    push("milestone", milestoneEvents, true);
    push("attested", attestedEvents, true);
    push("refunded", refundedEvents, true);

    out.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return b.blockNumber > a.blockNumber ? 1 : -1;
      return b.logIndex - a.logIndex;
    });
    return out.slice(0, limit);
  }, [
    joinedEvents,
    registeredEvents,
    committedEvents,
    milestoneEvents,
    attestedEvents,
    refundedEvents,
    nodeSet,
    limit,
  ]);

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: "14px 0",
          borderTop: "1px solid var(--ink)",
          fontSize: 13,
          color: "var(--ink-3)",
        }}
      >
        No activity yet. Wire populates from on-chain events as they happen.
      </div>
    );
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((e, i) => (
        <li
          key={e.key}
          style={{
            padding: "12px 0",
            borderTop: i === 0 ? "1px solid var(--ink)" : "1px solid var(--hair)",
            fontSize: 13,
            color: "var(--ink-2)",
            display: "flex",
            gap: 10,
            alignItems: "baseline",
          }}
        >
          <span className="micro" style={{ fontSize: 10, color: "var(--ink-4)", minWidth: 78 }}>
            blk {e.blockNumber.toString().slice(-6)}
          </span>
          <span style={{ flex: 1 }}>
            <WireLine event={e} city={city} neighborhood={neighborhood} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function WireLine({ event, city, neighborhood }: { event: WireEvent; city: string; neighborhood: string }) {
  const a = event.args;

  switch (event.kind) {
    case "joined": {
      const wallet = a.wallet as `0x${string}`;
      const label = a.label as string;
      return (
        <>
          <ENSName address={wallet} size="sm" /> joined as <strong>{label}</strong>
        </>
      );
    }
    case "registered": {
      const label = a.label as string;
      const type = a.resourceType as string | undefined;
      return (
        <>
          <span style={{ color: "var(--ink-3)" }}>opened</span>{" "}
          <Link
            href={`/${city}/${neighborhood}/p/${label}`}
            style={{ color: "var(--ink)", textDecoration: "underline" }}
          >
            {label}
          </Link>
          {type ? <span style={{ color: "var(--ink-4)" }}> · {type}</span> : null}
        </>
      );
    }
    case "committed": {
      const member = a.member as `0x${string}`;
      const amount = a.amount as bigint;
      return (
        <>
          <ENSName address={member} size="sm" /> committed <strong>{fmtUsdc(amount)}</strong>{" "}
          <span style={{ color: "var(--ink-4)" }}>· {shortNode(event.proposalNode)}</span>
        </>
      );
    }
    case "milestone": {
      const milestone = Number(a.milestone ?? 0);
      const amount = a.amount as bigint;
      return (
        <>
          <span style={{ color: "var(--ink-3)" }}>milestone {milestone} released</span>{" "}
          <strong>{fmtUsdc(amount)}</strong>{" "}
          <span style={{ color: "var(--ink-4)" }}>· {shortNode(event.proposalNode)}</span>
        </>
      );
    }
    case "attested": {
      const member = a.member as `0x${string}`;
      const count = Number(a.attestationCount ?? 0);
      return (
        <>
          <ENSName address={member} size="sm" /> attested{" "}
          <span style={{ color: "var(--ink-4)" }}>
            (#{count} · {shortNode(event.proposalNode)})
          </span>
        </>
      );
    }
    case "refunded": {
      const member = a.member as `0x${string}`;
      const amount = a.amount as bigint;
      return (
        <>
          <ENSName address={member} size="sm" /> refunded <strong>{fmtUsdc(amount)}</strong>
        </>
      );
    }
    default:
      return <>{event.kind}</>;
  }
}
