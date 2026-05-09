"use client";

import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

/// Small "connect to do X" inline panel. Used in CommitForm/AttestButton/etc.
/// when the action requires a wallet but none is connected.
export function ConnectPrompt({ message }: { message: string }) {
  return (
    <div className="bg-base-200 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <p className="text-sm opacity-80">{message}</p>
        <RainbowKitCustomConnectButton />
      </div>
      <p className="text-xs opacity-60">
        Need testnet funds? Get Base Sepolia ETH from the{" "}
        <a
          href="https://www.alchemy.com/faucets/base-sepolia"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-100"
        >
          Alchemy faucet
        </a>
        {" · "}
        <a
          href="https://portal.cdp.coinbase.com/products/faucet"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-100"
        >
          Coinbase faucet
        </a>
        . Mock USDC mints free from inside the app.
      </p>
    </div>
  );
}
