# Hromada

**A neighborhood commons protocol.**

Neighbors pool funds for shared physical resources — solar panels, retrofits, tool libraries, bulk purchasing — using threshold-commit smart contracts with auto-refund. ENS subnames serve as identity, resource registry, credentials, and discovery. The naming hierarchy mirrors real-world geography: `anna.vinohrady.prague.hromada.eth`.

> _hromada_ — Ukrainian for community self-governance.

## Stack

- **Contracts**: Foundry, deployed to Base Sepolia (data) + Sepolia (ENS resolver)
- **Frontend**: Next.js + wagmi v2 + viem v2 (Scaffold-ETH 2 monorepo)
- **CCIP-Read gateway**: Next.js API route at `/api/ccip/[sender]/[callData]`
- **Settlement**: USDC on Base Sepolia
- **ENS**: ENSIP-10 wildcard + EIP-3668 CCIP-Read + ENSIP-9/11 multi-coin + ENSIP-7 contenthash

## Status

Built for ETHPrague 2026 hackathon.

## Quickstart

```bash
yarn install
yarn chain          # local Foundry node
yarn deploy         # deploy contracts
yarn start          # dev server
```

See `packages/foundry/` for contracts and `packages/nextjs/` for the app.

## Roadmap

- **v1** (this repo): Threshold-commit pools, auto-refund, milestone escrow with attestation, CCIP-Read across L1/L2, multi-coin resolution, contenthash for proposal docs
- **v2**: EIP-5564 stealth addresses + gasless relayer for private contributions
- **v3**: Mainnet deploy + first real Vinohrady neighborhood with live neighbors
- **v4**: Federation across cities (Prague + Berlin + Lisbon), cross-neighborhood bulk-purchase discovery
