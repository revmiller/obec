// ENSIP-9 / ENSIP-11 coin type constants used by the resolver gateway.
// Reference: https://docs.ens.domains/ensip/9 + https://docs.ens.domains/ensip/11

/// Ethereum mainnet (default ENS coinType for ETH addresses)
export const COIN_TYPE_ETH = 60n;

/// Base Sepolia per ENSIP-11 derivation (chain id 84532)
/// 0x80000000 | 84532 = 2147568180
export const COIN_TYPE_BASE_SEPOLIA = 2147568180n;

/// Chain that hosts the Hromada state contracts (Registry / Pool / MockUSDC).
/// All write-action sites guard on this via <NetworkGuard targetChainId={STATE_CHAIN_ID} />.
export const STATE_CHAIN_ID = 84532; // Base Sepolia
