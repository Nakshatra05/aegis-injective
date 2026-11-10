export const CHAIN_ID = "injective-888" as const;
export const RPC = "https://sentry.tm.testnet.injective.network";
export const LCD = "https://sentry.lcd.testnet.injective.network";
export const GRPC = "https://sentry.grpc-web.testnet.injective.network";
export const INDEXER =
  "https://testnet.sentry.exchange.grpc-web.injective.network";
export const MARKET =
  "0x0611780ba69656949525013d947713300f56c37b6175e02f26bffa495c3208fe";
export const QUOTE = "peggy0x87aB3B4C8661e07D6372361211B96ed4Dc36B1B5";
export const EXPLORER = "https://testnet.explorer.injective.network";
export const FAUCET = "https://testnet.faucet.injective.network/";
export const GITHUB =
  process.env.NEXT_PUBLIC_GITHUB_URL ||
  "https://github.com/Nakshatra05/aegis-injective";
export type Policy = {
  id: number;
  agent: string;
  per_order: string;
  cap: string;
  spent: string;
  expires_at: number;
  revoked: boolean;
  max_price: string;
  next_nonce: number;
};
export type VaultState = {
  owner: string;
  policy: Policy | null;
  chain: string;
  market: string;
};
export type Activity = {
  id: string;
  kind:
    | "proposal"
    | "preflight_rejection"
    | "submitted"
    | "onchain_failure"
    | "confirmed_execution"
    | "confirmed_transaction"
    | "broadcast_unknown";
  created_at: string;
  summary: string;
  tx_hash?: string;
  reason?: string;
  vault: string;
  owner: string;
  payload?: unknown;
};
export function policyStatus(p: Policy, chainTime: number) {
  return p.revoked
    ? "revoked"
    : chainTime >= p.expires_at
      ? "expired"
      : "active";
}
