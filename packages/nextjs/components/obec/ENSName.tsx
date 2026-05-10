"use client";

import { Fragment } from "react";
import type { Address as AddressType } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_NODE = `0x${"0".repeat(64)}`;

type Size = "sm" | "md" | "lg";

const fontSizeFor = (size: Size) => (size === "lg" ? 16 : size === "sm" ? 11 : 13);

/**
 * Render an ENS subname with the leaf emphasized and the parent path
 * faded into mono marginalia. Pass either a `name` string or an
 * `address` — when given an address, the registry resolves it to a
 * subname; falls back to a truncated hex.
 */
export function ENSName({
  name,
  address,
  size = "md",
  emphasizeLeaf = true,
}: {
  name?: string;
  address?: AddressType;
  size?: Size;
  emphasizeLeaf?: boolean;
}) {
  if (name) {
    return <RenderName name={name} size={size} emphasizeLeaf={emphasizeLeaf} />;
  }
  return <ResolveAndRender address={address} size={size} emphasizeLeaf={emphasizeLeaf} />;
}

function ResolveAndRender({
  address,
  size,
  emphasizeLeaf,
}: {
  address?: AddressType;
  size: Size;
  emphasizeLeaf: boolean;
}) {
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

  if (!address || address === ZERO_ADDRESS) {
    return (
      <span className="ens" style={{ fontStyle: "italic" }}>
        unassigned
      </span>
    );
  }

  if (labels && Array.isArray(labels) && labels.length > 0) {
    const fullName = `${[...labels].join(".")}.${PROTOCOL_ROOT}`;
    return <RenderName name={fullName} size={size} emphasizeLeaf={emphasizeLeaf} />;
  }

  const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return (
    <span className="mono" style={{ fontSize: fontSizeFor(size), color: "var(--ink-3)" }} title={address}>
      {truncated}
    </span>
  );
}

function RenderName({ name, size, emphasizeLeaf }: { name: string; size: Size; emphasizeLeaf: boolean }) {
  const parts = name.split(".");
  return (
    <span className="ens" style={{ fontSize: fontSizeFor(size) }}>
      {parts.map((p, i) => {
        const isLeaf = i === 0;
        const isTld = i === parts.length - 1;
        const cls = isTld ? "ens-tld" : isLeaf && emphasizeLeaf ? "ens-self" : "ens-parent";
        return (
          <Fragment key={i}>
            <span className={cls}>{p}</span>
            {i < parts.length - 1 && <span className="ens-dot">.</span>}
          </Fragment>
        );
      })}
    </span>
  );
}
