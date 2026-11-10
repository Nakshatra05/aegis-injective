# Verification evidence

As of 10 November 2026. This file separates implementation checks from actual network transactions.

| Check | Result |
|---|---|
| Live RPC chain ID and height | Passed; see network.json |
| Live INJ/USDT market metadata | Passed; active, expected denoms/decimals/ticks |
| Indexer order book | Returned visible bids/asks; not a fill guarantee |
| Rust unit and transaction-level tests | 18 passed; exchange is simulated in transaction tests |
| Rust release Wasm build | Passed locally |
| TypeScript tests | 5 passed |
| Strict TypeScript | Passed |
| ESLint | Passed after correcting effects and config export |
| Next.js production build | Passed |
| Browser desktop landing page | Inspected at 1440px |
| GitHub repository creation | Confirmed by remote HEAD fe61e892208b8698584b6b830155f7519176dc53 |
| Contract upload/instantiate | Not run: testnet funding required |
| Successful real exchange fill | Not run |
| Included transaction rejected by policy | Not run |
| Connected Keplr signing / wallet rejection | Not verified yet |
| Hosted PostgreSQL execution | Not configured yet |
| Real AI call | No API key configured |

No code ID, contract address, or transaction hash is fabricated. Test account addresses in test-accounts.json are newly generated public addresses, not deployed contracts.
