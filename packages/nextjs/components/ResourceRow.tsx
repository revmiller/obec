"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { Meter, Pill } from "~~/components/obec";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";
const USDC_DECIMALS = 6;

// Mirror of solidity `enum Status { None, Active, Executing, Completed, Expired, Disputed }`.
const STATUS = {
  None: 0,
  Active: 1,
  Executing: 2,
  Completed: 3,
  Expired: 4,
  Disputed: 5,
} as const;

type Props = {
  node: `0x${string}`;
  city: string;
  neighborhood: string;
  index: number;
};

export function ResourceRow({ node, city, neighborhood, index }: Props) {
  const { data: resource } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "resources",
    args: [node],
  });

  const isActive = resource && Array.isArray(resource) && resource[4];
  const label = isActive ? (resource[1] as string) : undefined;
  const type = isActive ? (resource[2] as string) : undefined;

  const { data: proposal } = useScaffoldReadContract({
    contractName: "CommitmentPool",
    functionName: "getProposal",
    args: [node],
  });

  if (!isActive || !label) return null;

  const target = proposal?.targetAmount ?? 0n;
  const totalCommitted = proposal?.totalCommitted ?? 0n;
  const targetUsd = target > 0n ? Number(formatUnits(target, USDC_DECIMALS)) : 0;
  const committedUsd = totalCommitted > 0n ? Number(formatUnits(totalCommitted, USDC_DECIMALS)) : 0;
  const status = Number(proposal?.status ?? STATUS.None);

  const isFundraising = status === STATUS.Active;
  const isLive = status === STATUS.Executing || status === STATUS.Completed;
  const isExpired = status === STATUS.Expired;
  const isDisputed = status === STATUS.Disputed;

  const href = `/${city}/${neighborhood}/p/${label}`;
  const ctaLabel = isFundraising ? "Commit" : "View";

  const inner = (
    <article
      className="grid items-center gap-6 grid-cols-[40px_1fr_140px] sm:grid-cols-[40px_1fr_180px_220px_100px]"
      style={{
        padding: "26px 0",
        borderTop: index === 0 ? "1px solid var(--ink)" : "1px solid var(--hair)",
      }}
    >
      <div className="num-tag" style={{ fontSize: 11, color: "var(--ink-3)" }}>
        0{index + 1}
      </div>
      <div>
        <h3
          className="serif"
          style={{
            fontSize: 26,
            margin: 0,
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
          }}
        >
          {label.replace(/-/g, " ")}
        </h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: "6px 0 6px", maxWidth: 520 }}>
          {type ? `Type: ${type}` : "—"}
        </p>
        <div className="ens" style={{ fontSize: 11 }}>
          <span className="ens-self">{label}</span>
          <span className="ens-parent">
            .{neighborhood}.{city}.
          </span>
          {PROTOCOL_ROOT.split(".").map((part, i, arr) => (
            <span key={i}>
              <span className={i === arr.length - 1 ? "ens-tld" : "ens-parent"}>{part}</span>
              {i < arr.length - 1 && <span className="ens-dot">.</span>}
            </span>
          ))}
        </div>
      </div>
      <div>
        {isFundraising && (
          <Pill tone="terracotta" dot>
            fundraising
          </Pill>
        )}
        {isLive && (
          <Pill tone="moss" dot>
            active
          </Pill>
        )}
        {isExpired && <Pill>expired</Pill>}
        {isDisputed && (
          <Pill tone="terracotta" dot>
            disputed
          </Pill>
        )}
      </div>
      <div className="hidden sm:block">
        {targetUsd > 0 ? (
          <>
            <Meter value={committedUsd} total={targetUsd} height={3} showLabels={false} />
            <div
              className="num"
              style={{
                fontSize: 12,
                color: "var(--ink-3)",
                marginTop: 8,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>
                <span style={{ color: "var(--ink)", fontWeight: 500 }}>${committedUsd.toLocaleString()}</span> / $
                {targetUsd.toLocaleString()}
              </span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>—</div>
        )}
      </div>
      <div className="hidden sm:flex" style={{ justifyContent: "flex-end" }}>
        <span
          style={{
            fontSize: 13,
            color: "var(--ink)",
            borderBottom: "1px solid var(--ink)",
            paddingBottom: 1,
          }}
        >
          {ctaLabel} →
        </span>
      </div>
    </article>
  );

  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      {inner}
    </Link>
  );
}
