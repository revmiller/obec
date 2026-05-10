"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Avatar } from "~~/components/obec";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const ZERO_NODE = `0x${"0".repeat(64)}` as const;

export const Header = () => {
  return (
    <header
      className="flex items-center gap-7 px-6 sm:px-10 py-5 bg-[var(--paper)]"
      style={{ borderBottom: "1px solid var(--hair)" }}
    >
      <Link href="/" className="flex items-baseline gap-3.5 no-underline">
        <span
          className="serif"
          style={{
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: "-0.04em",
            color: "var(--ink)",
            lineHeight: 1,
          }}
        >
          obec
        </span>
      </Link>

      <div className="flex-1" />

      <div className="hidden md:block">
        <Identity />
      </div>

      <WalletControl />
    </header>
  );
};

function WalletControl() {
  const { isConnected } = useAccount();
  const [walletOpen, setWalletOpen] = useState(false);
  const walletRef = useRef<HTMLDivElement>(null);
  useOutsideClick(walletRef, () => setWalletOpen(false));

  if (!isConnected) {
    return (
      <ConnectButton.Custom>
        {({ openConnectModal, mounted }) => (
          <button className="obec-btn sm" disabled={!mounted} onClick={openConnectModal} aria-label="Log in">
            Log in
            <span className="arrow">→</span>
          </button>
        )}
      </ConnectButton.Custom>
    );
  }

  return (
    <div ref={walletRef} className="relative">
      <button className="obec-btn ghost sm" onClick={() => setWalletOpen(v => !v)} aria-expanded={walletOpen}>
        Wallet
      </button>
      {walletOpen && (
        <div
          className="absolute right-0 mt-2 z-30 p-3 bg-[var(--paper)]"
          style={{ border: "1px solid var(--hair)", minWidth: 280 }}
        >
          <RainbowKitCustomConnectButton />
        </div>
      )}
    </div>
  );
}

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";

function Identity() {
  const { address, isConnected } = useAccount();

  const { data: node, isPending: nodePending } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNodeByAddress",
    args: [address],
  });
  const hasMembership = !!node && node !== ZERO_NODE;

  const { data: labels, isPending: labelsPending } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNodeLabels",
    args: hasMembership ? [node] : [undefined],
  });

  if (!isConnected || !address) return null;

  if (nodePending || (hasMembership && labelsPending)) {
    return (
      <span
        className="mono pl-5"
        style={{ borderLeft: "1px solid var(--hair)", height: 18, fontSize: 12, color: "var(--ink-3)" }}
        aria-hidden
      />
    );
  }

  if (Array.isArray(labels) && labels.length > 0) {
    const leaf = labels[0];
    const parent = labels.slice(1).join(".");
    return (
      <span
        className="mono flex items-center gap-2 pl-5"
        style={{ borderLeft: "1px solid var(--hair)", height: 18, fontSize: 12, color: "var(--ink-2)" }}
      >
        <Avatar handle={leaf} size="sm" />
        <span style={{ fontWeight: 500 }}>
          {leaf}
          <span style={{ color: "var(--ink-4)" }}>.{parent || PROTOCOL_ROOT}</span>
        </span>
      </span>
    );
  }

  return (
    <span className="mono pl-5" style={{ borderLeft: "1px solid var(--hair)", fontSize: 12, color: "var(--ink-3)" }}>
      {address.slice(0, 6)}…{address.slice(-4)}
    </span>
  );
}
