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

🌐 **Live demo**: wip

---

We treat ENS as a programmable, cross-chain registry that a state machine on L2 writes to as the protocol changes — and any wallet on mainnet can read those changes through CCIP-Read with cryptographic guarantees.

Concrete instances of *ENS doing real work, not display*:

1. **The state machine writes ENS as it executes.** A project gets a single ENS subname at proposal creation; the pool atomically writes `status` ("proposing" → "active" → "completed"/"expired"), `maintainer`, and `attestations` text records as the lifecycle progresses, and on expiry deactivates the registry row so the dead project drops out of the neighborhood listing. ENS is *part* of the state machine, not metadata about it.
2. **Subnames are functional addresses.** `addr(node)` returns the funding pool — `cargo-bikes.vinohrady.prague.obec.eth` resolves to the escrow contract on the right chain so a wallet that knows the protocol can drive `CommitmentPool.commit(node, amount)` against it. The name *is* the route.
3. **Subnames as ACL.** Membership in the namespace = permission to modify it. `_canModify` checks ENS-derived membership.
4. **Multi-coin per subname.** `addr(node, 2147568180)` returns the Base Sepolia address; `addr(node, 60)` returns Ethereum. One name, multichain rails.
5. **The 5-faces beat.** Same project subname resolves five different ways: pool address, multichain address, `status`, `maintainer`, `contenthash`.
6. **ENSIP-19 reverse on L2.** Seeded wallets show their `anna.vinohrady…` name natively on Basescan.
7. **Federation discovery on the protocol root.** `text(obec.eth, "cities")` makes the root itself an ENS-discoverable data structure.

---

## ENS standards in play

| Standard | Where |
|---|---|
| ENSIP-10 wildcard (`IExtendedResolver`) | `ObecResolver.sol` |
| EIP-3668 CCIP-Read | Resolver + Next.js gateway at `/api/ccip/[sender]/[callData]` |
| ENSIP-9/11 multi-coin | Gateway returns Base Sepolia addr for coinType 2147568180 |
| ENSIP-7 contenthash | Project subnames expose a contenthash slot (v1 demo seeds a placeholder; v2 pins real docs) |
| ENSIP-19 default reverse (L2) | Member wallets register reverse names via `L2ReverseRegistrar` on Base Sepolia |
| EIP-137 namehash | All text records keyed by canonical namehash via `NameCoder` |

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

## Demo state

The Base Sepolia demo state shows:

- `obec.eth` → `text("cities") = "prague"` (federation discovery)
- `vinohrady.prague.obec.eth` — (example) Prague neighborhood with 15 members
- 15 member subnames (`anna…ondra`) with **ENSIP-19 reverse names** registered on Base Sepolia (Basescan shows `anna.vinohrady…` instead of `0x…`)
- `cargo-bikes.vinohrady.prague.obec.eth` — single project subname spanning the full lifecycle: proposal funded ($8,400 from 14 members), executor = `karel`. All five records populated:
  - `addr(node)` → pool
  - `addr(node, 2147568180)` → same, ENSIP-11
  - `text("status")` → `active` (flips through `proposing` → `active` → `completed`, or `expired` on a missed threshold)
  - `text("maintainer")` → `karel.vinohrady…` (frontend resolves to ENS)
  - `text("attestations")` → 8 attesters (frontend resolves each)
  - `contenthash(node)` → placeholder CID (v2 pins real usage docs)

Pool state: milestone 0 (30%) and milestone 1 (50%) released to executor; milestone 2 (20%) claimable after warranty.

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
