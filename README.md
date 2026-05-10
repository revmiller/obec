# Obec

**ENS-native protocol for neighborhood commons.** Neighbors pool USDC for shared physical resources via threshold-commit smart contracts. **Auto-refund if the fundraise falls short**; milestone-released escrow if it succeeds, with attestation-gated payouts. ENS subnames serve as identity, credentials, resource registry, and multichain payment rails.

The naming hierarchy mirrors real-world geography:

```
anna . vinohrady . prague . obec.eth
  │         │          │         │
  │         │          │         └─ protocol root
  │         │          └─ city
  │         └─ neighborhood
  └─ member
```

Built for **ETHPrague 2026**.

- 🌐 **Live demo**: https://obec-prague.vercel.app
- 🔎 **Protocol root**: [`obec.eth`](https://sepolia.app.ens.domains/obec.eth) (Sepolia ENS)
- 📜 **All contracts verified** on Etherscan + Basescan ([see addresses](#deployed-contracts))

---

We treat ENS as a programmable, cross-chain registry that a state machine on L2 writes to as the protocol changes — and any wallet on mainnet can read those changes through CCIP-Read with cryptographic guarantees.

Concrete instances of *ENS doing real work, not display*:

1. **The state machine writes ENS as it executes.** A project gets a single ENS subname at proposal creation; the pool atomically writes `status` ("proposing" → "active" → "completed"/"expired"), `maintainer`, and `attestations` text records as the lifecycle progresses, and on expiry deactivates the registry row so the dead project drops out of the neighborhood listing. ENS is *part* of the state machine, not metadata about it.
2. **Subnames are functional addresses.** `addr(node)` returns the funding pool — a stranger paying `cargo-bikes.vinohrady.prague.obec.eth` lands funds in the right escrow on the right chain. The name *is* the route.
3. **Subnames as ACL.** Membership in the namespace = permission to modify it. `_canModify` checks ENS-derived membership.
4. **Multi-coin per subname.** `addr(node, 2147568180)` returns the Base Sepolia address; `addr(node, 60)` returns Ethereum. One name, multichain rails.
5. **The 5-faces beat.** Same project subname resolves five different ways: pool address, multichain address, `status`, `maintainer`, `contenthash`.
6. **ENSIP-19 reverse on L2.** Seeded wallets show their `anna.vinohrady…` name natively on Basescan.
7. **Federation discovery on the protocol root.** `text(obec.eth, "cities")` makes the root itself an ENS-discoverable data structure.

---

## ENS standards in play

Each row links to the official spec and the exact implementation in this repo.

| Standard | Spec | Implementation |
|---|---|---|
| **ENSIP-10** wildcard (`IExtendedResolver`) | [docs.ens.domains/ensip/10](https://docs.ens.domains/ensip/10) | [`ObecResolver.sol#L75`](packages/foundry/contracts/ObecResolver.sol#L75) — `resolve()` always reverts with `OffchainLookup`; [`#L69`](packages/foundry/contracts/ObecResolver.sol#L69) — `supportsInterface(IExtendedResolver)` returns true |
| **EIP-3668** CCIP-Read | [eips.ethereum.org/EIPS/eip-3668](https://eips.ethereum.org/EIPS/eip-3668) | Resolver: [`ObecResolver.sol`](packages/foundry/contracts/ObecResolver.sol); gateway: [`route.ts`](packages/nextjs/app/api/ccip/[sender]/[callData]/route.ts) + [`ccip-handler.ts`](packages/nextjs/lib/ccip-handler.ts); EIP-191 v0 signing: [`ccip-signer.ts`](packages/nextjs/lib/ccip-signer.ts) |
| **ENSIP-9 / ENSIP-11** multi-coin (Base Sepolia coinType `2147568180`) | [ensip/9](https://docs.ens.domains/ensip/9) · [ensip/11](https://docs.ens.domains/ensip/11) | [`ccip-handler.ts#L99`](packages/nextjs/lib/ccip-handler.ts#L99) — strict legacy/multi-coin return-type split; [`coin-types.ts`](packages/nextjs/lib/coin-types.ts) — canonical constants |
| **ENSIP-7** contenthash | [ensip/7](https://docs.ens.domains/ensip/7) · [EIP-1577](https://eips.ethereum.org/EIPS/eip-1577) | [`ObecRegistry.sol#L175`](packages/foundry/contracts/ObecRegistry.sol#L175) `setContenthash`; gateway: [`ccip-handler.ts#L154`](packages/nextjs/lib/ccip-handler.ts#L154) |
| **ENSIP-19** default L2 reverse (Basescan shows `anna.vinohrady.prague.obec.eth` instead of `0x…`) | [docs.ens.domains/ensip/19](https://docs.ens.domains/ensip/19) | [`JoinNeighborhoodButton.tsx`](packages/nextjs/components/JoinNeighborhoodButton.tsx) — every join auto-fires `L2ReverseRegistrar.setName`. Canonical address: `0x00000BeEF055f7934784D6d81b6BC86665630dbA` |
| **EIP-137** namehash | [eips.ethereum.org/EIPS/eip-137](https://eips.ethereum.org/EIPS/eip-137) | `ObecRegistry` uses `NameCoder.namehash` from [ensdomains/ens-contracts](https://github.com/ensdomains/ens-contracts); frontend uses `viem.namehash` for cross-language correctness |
| **State-machine writes ENS atomically** (the central creative beat) | — | [`CommitmentPool.sol#L247`](packages/foundry/contracts/CommitmentPool.sol#L247) — `_transitionToFunded` creates resource subname + writes 3 text records + releases milestone 0, all in one tx |
| **Federation discovery on protocol root** | — | [`ObecRegistry.sol#L181`](packages/foundry/contracts/ObecRegistry.sol#L181) — `_canModify` permits owner to write text records on `PROTOCOL_ROOT_NAMEHASH`. Seeded value: `text(obec.eth, "cities") = "prague"` |

---

## Deployed contracts

All four contracts deployed and **source-verified** on the official block explorers. Base Sepolia trio redeployed at block 41316923 for the unified-subname ABI; Sepolia resolver unchanged.

| Contract | Chain | Address | Verified |
|---|---|---|---|
| [`ObecRegistry`](packages/foundry/contracts/ObecRegistry.sol) | Base Sepolia (84532) | `0xbA94E169259A8Ce41756De7Cc0800DD5faaD5b72` | [Basescan ✓](https://sepolia.basescan.org/address/0xbA94E169259A8Ce41756De7Cc0800DD5faaD5b72#code) |
| [`CommitmentPool`](packages/foundry/contracts/CommitmentPool.sol) | Base Sepolia (84532) | `0x4983155e14018f2BE6B8B41A34FAdf0Cb1ffeFaf` | [Basescan ✓](https://sepolia.basescan.org/address/0x4983155e14018f2BE6B8B41A34FAdf0Cb1ffeFaf#code) |
| [`MockUSDC`](packages/foundry/contracts/MockUSDC.sol) | Base Sepolia (84532) | `0x174AE58CD543d852Dff72bb971A3B874b56E1832` | [Basescan ✓](https://sepolia.basescan.org/address/0x174AE58CD543d852Dff72bb971A3B874b56E1832#code) |
| [`ObecResolver`](packages/foundry/contracts/ObecResolver.sol) | Sepolia (11155111) | `0xedA49dB1213e783EF25DE41f9B4E82711F8D7bbD` | [Etherscan ✓](https://sepolia.etherscan.io/address/0xedA49dB1213e783EF25DE41f9B4E82711F8D7bbD#code) |

ENS Sepolia Registry at `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` has `setResolver(namehash("obec.eth"), 0xedA49…7bbD)`. Verify yourself:

```bash
cast call 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e \
  "resolver(bytes32)" $(cast namehash obec.eth) \
  --rpc-url https://eth-sepolia.g.alchemy.com/v2/<key>
# returns 0x000…edA49dB1213e783EF25DE41f9B4E82711F8D7bbD
```

---

## Verify the ENS flow yourself

The cryptographic-correctness proof: **standard ENS infra resolves Obec subnames live, with no Obec-specific code on the client side.**

```bash
NEXT_PUBLIC_PROTOCOL_ROOT=obec.eth \
NEXT_PUBLIC_ALCHEMY_API_KEY=<your-key> \
npx tsx packages/nextjs/scripts/smoke-test.ts \
  vinohrady.prague.obec.eth \
  <member>.vinohrady.prague.obec.eth \
  cargo-bikes.vinohrady.prague.obec.eth
```

Full path on each lookup: `viem.getEnsAddress` on Sepolia → ENS Registry → `ObecResolver.resolve()` reverts with `OffchainLookup` → viem follows to `obec-prague.vercel.app/api/ccip/{sender}/{data}` → gateway queries `ObecRegistry` on Base Sepolia → signs response (EIP-191 v0, intended-validator scheme) → viem submits to `resolveWithProof` → resolver verifies signature on-chain → result returned. Round-trip ~300ms with 60s in-memory cache.

---

## Architecture

```
┌─ Sepolia ──────────────────────┐    ┌─ Base Sepolia ─────────────────────┐
│                                │    │                                    │
│  ObecResolver               │    │  ObecRegistry                   │
│  ├─ resolve() reverts with     │    │  ├─ neighborhoods, members,        │
│  │  OffchainLookup             │◀───┤  │  resources, text records       │
│  └─ resolveWithProof()         │CCIP│  └─ namehash-keyed                 │
│      verifies EIP-191 sig      │ -R │                                    │
│                                │ ead│  CommitmentPool                    │
└────────────┬───────────────────┘    │  ├─ USDC threshold-commit          │
             │                        │  ├─ 30/50/20 milestone split       │
             │ OffchainLookup         │  ├─ M-of-N attestation             │
             ▼                        │  └─ writes ENS records on funding  │
        ┌──────────────────────────┐  │                                    │
        │  Next.js gateway         │  │  MockUSDC (demo)                   │
        │  /api/ccip/[s]/[d]       │──▶                                    │
        │  ├─ decodes callData     │  └────────────────────────────────────┘
        │  ├─ queries Base Sepolia │
        │  ├─ signs (EIP-191)      │
        │  └─ 60s in-memory cache  │
        └──────────────────────────┘
```

State machine (CommitmentPool):

```
None → Active → Executing → Completed
              ↘ Expired
              ↘ Disputed
```

The bold names below are the on-chain `Status` enum (the pool's source of truth). The lowercase string in parentheses is the `status` text record that the pool writes for off-chain consumers. The two namespaces overlap but don't match exactly — e.g. enum `Active` corresponds to text `"proposing"`, and enum `Executing` corresponds to text `"active"`.

- **Active** (status text "proposing"): project subname registered; members commit USDC; auto-refund if deadline passes without threshold.
- **Executing** (status text "active", threshold met): milestone 0 released; maintainer anchored.
- **Completed** (status text "completed", warranty elapsed after attestation threshold): all milestones released.
- **Expired** (status text "expired"): registry row deactivated and removed from the neighborhood list. The pool's namehash slot stays tombstoned, so a retry uses a new label.

---

## Demo (live)

Visible at https://obec-prague.vercel.app — fresh registry as of the latest deploy. Walking through the dApp exercises the full flow:

- **Federation discovery** — home reads `text("obec.eth", "cities")` to render the city index.
- **Open a city** — anyone can seed `<city>.obec.eth` by creating its first neighborhood under it; no permissioned onboarding.
- **Open a neighborhood** — first creator becomes admin. Namehash registered onchain; neighborhood resolves via ENS from any wallet.
- **Join** — every member gets `<label>.<neighborhood>.<city>.obec.eth` plus an automatic **ENSIP-19** reverse name on Base Sepolia, so Basescan shows the full ENS name instead of `0x…`.
- **Propose a project** — the project subname is registered atomically with the proposal. Threshold + deadline + auto-refund baked in.
- **Commit / attest / release** — as the state machine advances, the pool writes `status`, `maintainer`, and `attestations` text records on the same subname. Funded projects expose:
  - `addr(node)` → pool escrow address
  - `addr(node, 2147568180)` → same, **ENSIP-11** multichain
  - `text("status")` → `proposing` → `active` → `completed` (or `expired`)
  - `text("maintainer")` → executor address
  - `text("attestations")` → comma-separated attester addresses
  - `contenthash(node)` → IPFS CID slot

All five record types resolve via standard `viem.getEnsAddress` / `getEnsText` lookups against Sepolia — no Obec-specific client code required.

---

## Quickstart

```bash
git clone https://github.com/revmiller/obec
cd obec
yarn install

# Local dev (Foundry anvil)
yarn chain          # in one terminal
yarn deploy         # in another — deploys all contracts to localhost
yarn start          # starts the Next.js frontend at :3000
```

For testnet:

```bash
# Base Sepolia: Registry + Pool + MockUSDC
yarn deploy --network baseSepolia --keystore <your-keystore>

# Sepolia: Resolver
yarn deploy --file DeployResolver.s.sol --network sepolia --keystore <your-keystore>
```

Required env (in `packages/foundry/.env`):

| Var | Description |
|---|---|
| `PROTOCOL_ROOT` | ENS name you control (e.g. `obec.eth`) |
| `GATEWAY_URL` | `https://<your-vercel>/api/ccip/{sender}/{data}` |
| `GATEWAY_SIGNER` | EOA address that signs gateway responses |
| `ALCHEMY_API_KEY`, `ETHERSCAN_API_KEY` | RPC + verification |
| `REGISTRY_ADDRESS`, `COMMITMENT_POOL_ADDRESS`, `MOCK_USDC_ADDRESS` | Set after Base Sepolia deploy |

Required Vercel env for the gateway:

| Var | Description |
|---|---|
| `GATEWAY_PRIVATE_KEY` | Private key matching `GATEWAY_SIGNER` |
| `RESOLVER_ADDRESS` | Sepolia resolver address (in EIP-191 digest) |
| `REGISTRY_ADDRESS` | Base Sepolia registry address |
| `BASE_SEPOLIA_RPC_URL` | Optional — defaults to Alchemy |
| `NEXT_PUBLIC_PROTOCOL_ROOT` | Same as foundry's `PROTOCOL_ROOT` |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | For frontend ENS resolution |

---

## Post-hackathon (potential) roadmap

- **EIP-5564 stealth + gasless relayer** — privacy. Registry's open key-value text store reserves space for `text(node, "scheme:1.1")` per ENSIP-19; v2 wires the relayer.
- **Smart-account onboarding** (Coinbase Smart Wallet, Privy) — gasless first commit; collapses approve+commit dance.
- **Mainnet + Base mainnet deploy** with first real Vinohrady deployment.
- **Dispute resolution** module replacing v1 stub (tbd)
- **Federation across cities** (Prague + Berlin + Lisbon) via the `cities` text record on the protocol root. Cross-neighborhood bulk-purchase discovery.
- **Pluggable verifiers** for join + fulfillment (e.g., gating by NFT, attestation contract).
- **ERC-1155 commitment receipts** as composable proof-of-participation tokens.

---

## Tech stack

- **Contracts**: Solidity (Foundry), OpenZeppelin, ens-contracts NameCoder
- **Frontend**: Next.js, wagmi, viem, RainbowKit, Tailwind
- **Gateway**: Next.js API route, EIP-191 signing, in-memory TTL cache
- **Monorepo**: Scaffold-ETH 2 
- **Deploy targets**: Base Sepolia (state) + Sepolia (resolver)

---

## License

MIT
