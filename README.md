# Aegis

**Give agents limits. Keep control.**

Testnet-only permissions vault for AI trading agents on Injective. Next.js dashboard + Rust CosmWasm enforcement. **Not audited. Not production-ready. Do not use mainnet funds.**

## Delivery status

- Repository: https://github.com/Nakshatra05/aegis-injective
- Vercel project: `aegis-injective`; deployment evidence is recorded in `docs/evidence` when available.
- Contract address/code ID: **not deployed yet**. No transaction hashes or successful fills are claimed.
- Local verification: 18 Rust tests, 5 TypeScript tests, strict type checking, ESLint, production build.
- Live network and order-book inspection: [network evidence](docs/evidence/network.json).
- Real contract deployment, exchange execution, and onchain policy rejection: **blocked on testnet funding**.
- Durable server activity/execution: implemented; requires `DATABASE_URL` before it is enabled.
- AI proposals: implemented through the server-side OpenAI API; disabled without a key. Manual structured proposals and explicitly labeled presets remain available.

The read-only demo is illustrative. It never signs, submits, or invents transaction links. A landing page and demo are not a completed connected testnet MVP; the outstanding gates above must be completed.

## Architecture and verified approach

Read [APPROACH.md](docs/APPROACH.md), written before implementation, for official source links and the architecture decision.

```text
Keplr owner ── sign owner action ──> Aegis vault
                                      │
Manual input / optional AI             │ immutable policy
       ↓                              │ agent + market + budget + expiry
strict proposal schema                │ revocation + price ceiling + nonce
       ↓                              │
owner-authenticated server session    │
       ↓                              │
PostgreSQL proposal + execution record │
       ↓                              │
restricted testnet agent signer ───────┘
                                      ↓
                           protobuf BuyAtomic order
                                      ↓
                           exchange + reply balance checks
                                      ↓
                           reserve full quote budget / revert
```

Native `CreateSpotMarketOrderAuthz` checks market/subaccount but does not enforce spending caps. The vault uses the officially recommended CosmWasm 2.0+ `CosmosMsg::Any` protobuf path, not an assumed EVM exchange integration or generic authz grant.

The vault has no arbitrary-call route, migration entrypoint, agent withdrawal, sell, derivative, leverage, or resting-order support. Instantiate with **no admin**. Each instance belongs to one wallet. One policy is current at a time; changing it requires owner revocation or expiry and explicit creation of a new policy ID.

### Exact accounting

USDT amounts are decimal strings converted to integer 6-decimal base units. INJ has 18 decimals. Price inputs are integer micro-USDT per INJ, restricted to a 0.001 USDT price tick. Quantity rounds down to the verified 0.001 INJ lot size. A 1% buffer is left for exchange fees; actual debit is independently checked in the reply, so the buffer is not an authorization loophole.

A successful atomic buy must increase vault INJ and decrease vault USDT by a positive amount no greater than the authorized quote budget. The contract then counts the **entire quote budget** against the policy cap, even if actual cost is lower. Any failed exchange call, zero fill, or failed reply bubbles up and rolls back all effects. Deposits, withdrawals and fee refunds never decrease `spent`. This conservative reservation can consume allowance faster than actual balances.

The immutable policy also contains an owner-approved maximum execution price. Each proposal has an equal or tighter limit. This is a hard price limit, not an oracle-based guarantee or an automatically sourced price quote. Changing market fee/tick configuration may cause rejection and requires revalidation before updating the application.

### Authentication and persistence

Keplr ADR-036 signatures authenticate the owner. Single-use PostgreSQL challenges bind the application origin, testnet chain, wallet, nonce and expiry. HttpOnly/SameSite session cookies expire in one hour. Mutating routes require the exact configured Origin. Every proposal/execution verifies onchain ownership and the allowlisted vault code ID, and rejects upgradeable instances.

The server-side agent signs only the restricted `buy` message for an owned, verified vault. The client cannot provide arbitrary transaction bytes. An execution is bound to its durable proposal, policy ID and onchain nonce. PostgreSQL uniqueness prevents duplicate submissions for the same policy nonce. Signed transaction bytes/hash are saved before broadcasting; pending state survives refresh and function restarts. The UI reconciles receipts without treating transport errors as onchain failures.

Owner wallet transaction hashes are saved in browser storage before broadcasting; clearing that storage loses this local view, but not chain history. Agent audit records require PostgreSQL and are not stored in Vercel's ephemeral filesystem or server memory. The DB client object may be reused; no authoritative permissions or audit records live in it.

Trust assumptions: the owner approves policy limits and funds; the operator protects the agent key and database; the wallet and chain behave correctly. A compromised agent can trade within a live policy, but cannot bypass its onchain caps, price ceiling, expiry, or withdrawal restrictions. AI output is untrusted and never authorizes execution.

## Local setup

Requirements: Node 22 or 24, npm, Rust, `wasm32-unknown-unknown` target, Keplr browser extension for connected use.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`, `/app`, or `/app?demo=1`. Set `APP_ORIGIN=http://localhost:3000` locally. The landing page, demo, local manual proposal inspection, and clear missing-configuration states work without credentials.

| Variable | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` | server secret | Durable PostgreSQL with TLS in hosted environments; tables are initialized on first use |
| `SESSION_SECRET` | server secret | Random value of at least 32 characters for session HMAC |
| `AGENT_PRIVATE_KEY` | server secret | Dedicated testnet-only agent key, never an owner/user key |
| `DEPLOYER_PRIVATE_KEY` | local secret | Testnet contract deployment and verification only; do not put on Vercel |
| `OPENAI_API_KEY` | optional server secret | Enables natural-language proposals |
| `OPENAI_MODEL` | server | Default `gpt-4.1-mini`; replaceable model name |
| `APP_ORIGIN` | server | Exact application origin, including scheme, for session/CSRF binding |
| `NEXT_PUBLIC_VAULT_CODE_ID` | public | Code ID returned by a real testnet deployment |
| `NEXT_PUBLIC_AGENT_ADDRESS` | public | Address corresponding to configured agent key |
| `NEXT_PUBLIC_GITHUB_URL` | public | Actual repository URL |

Only placeholder values belong in `.env.example`. Never put secrets in a `NEXT_PUBLIC_` variable, chat, logs, Git, or frontend code. `.env.local`, build output, and Rust target directories are ignored.

## Contract build and deployment

```sh
rustup target add wasm32-unknown-unknown
cargo test --manifest-path contracts/Cargo.toml
cargo build --manifest-path contracts/Cargo.toml --release --target wasm32-unknown-unknown
npm run deploy:contract
```

The deployment script is testnet-only, uses a locally configured deployer key, saves pending hashes before broadcast, waits for receipts, stores the code, and instantiates a non-upgradeable vault. If receipt waiting times out, inspect the saved hash before rerunning; do not blindly deploy another instance. Successful evidence is written to `docs/evidence/deployment.json` and receipt files. Set the resulting code ID publicly only after verifying the actual receipt.

The Wasm artifact is `contracts/target/wasm32-unknown-unknown/release/aegis_vault.wasm`. For reproducible distribution, pin an official CosmWasm optimizer image by digest and validate the artifact against the target chain; a local Wasm build alone is not proof of chain acceptance.

## Verified testnet configuration

- Cosmos chain: `injective-888` (never mainnet `injective-1`).
- RPC: https://sentry.tm.testnet.injective.network
- LCD: https://sentry.lcd.testnet.injective.network
- gRPC-Web: https://sentry.grpc-web.testnet.injective.network
- Spot indexer: https://testnet.sentry.exchange.grpc-web.injective.network
- Explorer: https://testnet.explorer.injective.network/
- INJ faucet: https://testnet.faucet.injective.network/
- Market: `0x0611780ba69656949525013d947713300f56c37b6175e02f26bffa495c3208fe` (INJ/USDT).
- Base: `inj`, 18 decimals.
- Quote: `peggy0x87aB3B4C8661e07D6372361211B96ed4Dc36B1B5`, 6 decimals.
- Minimum notional observed: 1 USDT. Price tick: 0.001 human USDT. Quantity tick: 0.001 INJ.

`npm run verify:chain` refreshes network, market and order-book evidence. At 2026-11-10T13:42Z the indexer returned bids/asks; best ask was 4.867 USDT with 0.5 INJ quantity. This is a snapshot, not a fill guarantee. Some resting liquidity is old. A live transaction must establish whether an order fills.

Funding: owner and agent need their own testnet INJ for gas; the vault needs supported USDT for buys. The official INJ faucet is not a promise of USDT distribution. Obtain that exact testnet USDT denom from a supported faucet or existing testnet account. Circle testnet USDC cannot substitute. Never bridge real assets or reuse a funded mainnet private key.

## Walkthrough

1. Without a wallet: choose **Explore the demo**. Inspect the sample policy and activity; all values are labeled sample data.
2. In the connected app: connect Keplr, create a vault, then review/sign a policy for the configured agent.
3. Deposit testnet USDT. Set an expiry and a sensible owner price ceiling.
4. Sign in with the owner wallet. Create a 5 USDT manual proposal (or use AI if configured), inspect checks, then execute through the agent.
5. Refresh activity until a receipt is found. Submitted ≠ filled. Only a vault `executed` event with successful receipt is a confirmed execution.
6. Inspect a 25 USDT proposal against a 10 USDT per-order cap. This produces a **preflight rejection**, not an onchain rejection.
7. Revoke the policy, wait for confirmation, then inspect another proposal. It must be blocked. To prove onchain enforcement independently, submit an invalid call directly using a funded agent in the verification script rather than bypassing the dashboard preflight.
8. Withdraw remaining INJ/USDT with the owner wallet. Withdrawal always targets the owner and never resets spent allowance.

## Tests and verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
cargo test --manifest-path contracts/Cargo.toml
```

Rust tests cover allowed/boundary execution, unauthorized caller, wrong market/direction/policy, oversized and zero budgets, cumulative caps, exact expiry boundary, revocation, replay, price ticks, owner withdrawal, immutable policy replacement, and testnet-only deployment. Transaction-level tests use a **simulated exchange** to verify protobuf amounts, atomic settlement, zero-fill rejection, fee overcharge rollback, and exchange failure rollback. They are not evidence of live Injective execution.

TypeScript tests cover exact decimals beyond JavaScript's safe integer range, precision/exponent rejection, policy preflight and strict proposal schema. Browser and deployment findings are recorded separately in `docs/evidence/VERIFICATION.md`.

## Deployment

Deploy the repository to Vercel as a Next.js project using Node 22. Configure production secrets securely in Vercel, not Git. Set `APP_ORIGIN` to the actual production domain. Public variables require rebuilding. A PostgreSQL service must be reachable from Vercel; no separate agent runner is needed because each execution is explicitly user-triggered through an authenticated route.

### Supabase PostgreSQL

Create a Supabase project, then choose **Connect → Transaction pooler**. Copy the PostgreSQL URI (port 6543), substitute the database password with URL encoding where needed, and save it as sensitive `DATABASE_URL` in Vercel's Production environment. Use the database-owner connection, not the project URL, anon key, or service-role API key. Redeploy after configuration. The server uses `postgres` with prepared statements disabled, a three-connection limit, and short idle timeouts. It creates its tables on first use and enables row-level security with no public policies; the server database owner bypasses RLS. Never expose the connection string through a `NEXT_PUBLIC_` variable.

Official instructions: https://supabase.com/docs/guides/database/connecting-to-postgres

## Remaining limits and next steps

- Complete funded testnet deployment and record a genuine successful buy and genuinely included policy-rejected transaction.
- Complete connected Keplr end-to-end tests, including wallet rejection and refresh while pending. Missing-wallet behavior is distinct from a wallet-signed transaction rejection.
- Configure and exercise hosted PostgreSQL and optional AI provider; absence stays explicit in UI.
- An unresolved agent transaction intentionally blocks subsequent signing to avoid sequence races. The activity recovery action rebroadcasts only the identical saved transaction, or releases its reservation after its chain timeout has passed. It never labels an unknown outcome as a successful fill.
- This is one testnet market with compile-time denoms/ticks. No derivatives, leverage, arbitrary routes, multi-chain logic, daily resets, or autonomous scheduled trading.
- Revocation is effective on inclusion; it cannot undo prior trades or outrun an already included execution.
- Independent security review, hardened rate limiting, operational recovery, and reproducible optimizer validation remain necessary before any broader use.
