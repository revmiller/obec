"use client";

import { useMemo } from "react";
import { formatUnits } from "viem";
import { ENSName } from "~~/components/obec";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

type Source = "ObecRegistry" | "CommitmentPool";

type FeedItem = {
  key: string;
  blockNumber: bigint;
  logIndex: number;
  source: Source;
  kind: "joined" | "registered" | "neighborhood" | "committed" | "milestone" | "attested";
  args: Record<string, unknown>;
  cityNeighborhood?: { city: string; neighborhood: string };
};

function fmtUsdc(raw: bigint): string {
  const n = Number(formatUnits(raw, USDC_DECIMALS));
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k USDC` : `${n.toLocaleString()} USDC`;
}

function ago(blocks: bigint): string {
  // Coarse heuristic: Base Sepolia ≈ 2s blocks. Used only for relative chip text.
  const sec = Number(blocks) * 2;
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

/**
 * Cross-protocol activity feed for the home page. Stitches registry events
 * (NeighborhoodCreated, MemberJoined, ResourceRegistered) with pool events
 * (Committed, MilestoneReleased, Attested), joined by neighborhoodId so each
 * pool event displays its city/neighborhood context.
 */
export function GlobalWireFeed({ limit = 3 }: { limit?: number }) {
  const { data: createdEvents } = useScaffoldEventHistory({
    contractName: "ObecRegistry",
    eventName: "NeighborhoodCreated",
    fromBlock: undefined,
    watch: true,
  });
  const { data: joinedEvents } = useScaffoldEventHistory({
    contractName: "ObecRegistry",
    eventName: "MemberJoined",
    fromBlock: undefined,
    watch: true,
  });
  const { data: registeredEvents } = useScaffoldEventHistory({
    contractName: "ObecRegistry",
    eventName: "ResourceRegistered",
    fromBlock: undefined,
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

  // neighborhoodId → { city, neighborhood }
  const neighborhoodMap = useMemo(() => {
    const m = new Map<string, { city: string; neighborhood: string }>();
    if (createdEvents) {
      for (const e of createdEvents) {
        const a = (e.args ?? {}) as { neighborhoodId?: string; city?: string; name?: string };
        if (a.neighborhoodId && a.city && a.name) {
          m.set(a.neighborhoodId.toLowerCase(), { city: a.city.toLowerCase(), neighborhood: a.name });
        }
      }
    }
    return m;
  }, [createdEvents]);

  // proposal/resource node → neighborhoodId, so we can resolve pool events to city/hood.
  const resourceMap = useMemo(() => {
    const m = new Map<string, string>();
    if (registeredEvents) {
      for (const e of registeredEvents) {
        const a = (e.args ?? {}) as { resourceNode?: string; neighborhoodId?: string };
        if (a.resourceNode && a.neighborhoodId) m.set(a.resourceNode.toLowerCase(), a.neighborhoodId.toLowerCase());
      }
    }
    return m;
  }, [registeredEvents]);

  const items = useMemo<FeedItem[]>(() => {
    const out: FeedItem[] = [];
    const pushReg = (kind: FeedItem["kind"], events: any[] | undefined) => {
      if (!events) return;
      for (const e of events) {
        const a = (e.args ?? {}) as { neighborhoodId?: string };
        const nh = a.neighborhoodId ? neighborhoodMap.get(a.neighborhoodId.toLowerCase()) : undefined;
        out.push({
          key: `${e.transactionHash}-${e.logIndex}`,
          blockNumber: BigInt(e.blockNumber ?? 0),
          logIndex: Number(e.logIndex ?? 0),
          source: "ObecRegistry",
          kind,
          args: e.args ?? {},
          cityNeighborhood: nh,
        });
      }
    };
    const pushPool = (kind: FeedItem["kind"], events: any[] | undefined) => {
      if (!events) return;
      for (const e of events) {
        const a = (e.args ?? {}) as { proposalNode?: string };
        const nhId = a.proposalNode ? resourceMap.get(a.proposalNode.toLowerCase()) : undefined;
        const nh = nhId ? neighborhoodMap.get(nhId) : undefined;
        out.push({
          key: `${e.transactionHash}-${e.logIndex}`,
          blockNumber: BigInt(e.blockNumber ?? 0),
          logIndex: Number(e.logIndex ?? 0),
          source: "CommitmentPool",
          kind,
          args: e.args ?? {},
          cityNeighborhood: nh,
        });
      }
    };

    pushReg("neighborhood", createdEvents);
    pushReg("joined", joinedEvents);
    pushReg("registered", registeredEvents);
    pushPool("committed", committedEvents);
    pushPool("milestone", milestoneEvents);
    pushPool("attested", attestedEvents);

    out.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return b.blockNumber > a.blockNumber ? 1 : -1;
      return b.logIndex - a.logIndex;
    });
    return out.slice(0, limit);
  }, [
    createdEvents,
    joinedEvents,
    registeredEvents,
    committedEvents,
    milestoneEvents,
    attestedEvents,
    neighborhoodMap,
    resourceMap,
    limit,
  ]);

  if (items.length === 0) {
    return (
      <p style={{ color: "var(--ink-3)", fontSize: 14, fontStyle: "italic" }}>
        No activity yet. The wire populates as members join, propose, and commit.
      </p>
    );
  }

  const head = items[0]?.blockNumber ?? 0n;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14">
      {items.map(item => {
        const elapsed = head > item.blockNumber ? head - item.blockNumber : 0n;
        const stamp = `${ago(elapsed)} ago`;
        const where = item.cityNeighborhood
          ? `${item.cityNeighborhood.neighborhood}.${item.cityNeighborhood.city}`
          : "obec";
        return (
          <article key={item.key} style={{ borderTop: "1px solid var(--ink)", paddingTop: 18 }}>
            <div className="micro" style={{ fontSize: 11 }}>
              {stamp}&nbsp;·&nbsp;{where}
            </div>
            <h4
              className="serif"
              style={{
                fontSize: 22,
                fontWeight: 400,
                lineHeight: 1.25,
                margin: "14px 0 0",
                letterSpacing: "-0.015em",
              }}
            >
              <FeedHeadline item={item} />
            </h4>
            <p style={{ fontSize: 14.5, color: "var(--ink-2)", marginTop: 14, lineHeight: 1.5 }}>
              <FeedBody item={item} />
            </p>
          </article>
        );
      })}
    </div>
  );
}

function FeedHeadline({ item }: { item: FeedItem }) {
  const a = item.args;
  switch (item.kind) {
    case "neighborhood":
      return (
        <>
          opened <em style={{ fontStyle: "italic" }}>{(a.name as string) ?? "neighborhood"}</em>
        </>
      );
    case "joined":
      return (
        <>
          <em style={{ fontStyle: "italic" }}>{(a.label as string) ?? "—"}</em>
          <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>&nbsp;joined&nbsp;</span>
        </>
      );
    case "registered": {
      return (
        <>
          <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>opened&nbsp;</span>
          <em style={{ fontStyle: "italic" }}>{(a.label as string) ?? "—"}</em>
        </>
      );
    }
    case "committed":
      return (
        <>
          <ENSName address={a.member as `0x${string}`} size="sm" />
          <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>&nbsp;committed&nbsp;</span>
          <em style={{ fontStyle: "italic" }}>{fmtUsdc(a.amount as bigint)}</em>
        </>
      );
    case "milestone":
      return (
        <>
          <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>milestone&nbsp;</span>
          {Number(a.milestone ?? 0)} of 02
          <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>&nbsp;released</span>
        </>
      );
    case "attested":
      return (
        <>
          <ENSName address={a.member as `0x${string}`} size="sm" />
          <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>&nbsp;attested&nbsp;</span>
        </>
      );
  }
}

function FeedBody({ item }: { item: FeedItem }) {
  const a = item.args;
  switch (item.kind) {
    case "neighborhood":
      return <>A new neighborhood has opened. The first creator is its admin.</>;
    case "joined":
      return <>Issued subname under the neighborhood. Welcome to the wire.</>;
    case "registered":
      return <>Pool open for commitments. Threshold-and-refund kicks in if it doesn&apos;t fund by deadline.</>;
    case "committed":
      return (
        <>
          Pool now at {fmtUsdc(a.totalCommitted as bigint)} total. Threshold and deadline determine when funds release.
        </>
      );
    case "milestone":
      return <>Funds released to the executor at {fmtUsdc(a.amount as bigint)}.</>;
    case "attested":
      return <>Attestation #{Number(a.attestationCount ?? 0)} recorded. Triggers the next milestone at quorum.</>;
  }
}
