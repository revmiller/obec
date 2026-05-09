"use client";

import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

/// Small "connect to do X" inline panel. Used in CommitForm/AttestButton/etc.
/// when the action requires a wallet but none is connected.
export function ConnectPrompt({ message }: { message: string }) {
  return (
    <div className="bg-base-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
      <p className="text-sm opacity-80">{message}</p>
      <RainbowKitCustomConnectButton />
    </div>
  );
}
