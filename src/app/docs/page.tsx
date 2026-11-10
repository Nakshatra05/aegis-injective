import Link from "next/link";
import { Brand } from "@/components/brand";
import { GITHUB, MARKET, FAUCET } from "@/lib/config";
export default function Docs() {
  return (
    <>
      <nav className="nav">
        <Brand />
        <Link href="/app" className="button small lime">
          Open dashboard ↗
        </Link>
      </nav>
      <main id="main" className="doc-page">
        <span className="eyebrow">AEGIS / DOCUMENTATION</span>
        <h1>
          A defined mandate.
          <br />
          Enforced onchain.
        </h1>
        <p>
          Aegis is a testnet-only permissions vault for one AI trading agent and
          the INJ/USDT spot market. This project is not audited or
          production-ready.
        </p>
        <div className="notice warning" id="deployment">
          <p>
            <strong>Deployment status:</strong>{" "}
            {process.env.NEXT_PUBLIC_VAULT_CODE_ID
              ? `Configured code ID: ${process.env.NEXT_PUBLIC_VAULT_CODE_ID}. Check the repository evidence for actual verification.`
              : "No verified contract deployment is configured yet. Live signing and execution are unavailable until deployment and funding are completed."}{" "}
            Demo values never represent real balances or trades.
          </p>
        </div>
        <h2>The execution boundary</h2>
        <p>
          Your Keplr wallet owns a separate CosmWasm vault. An immutable policy
          gives one agent permission to submit atomic spot buys. The vault
          validates the agent, policy ID, market, direction, amount, cumulative
          allowance, expiry using chain time, nonce, revocation, and price
          ceiling. There is no arbitrary execution entrypoint.
        </p>
        <p>
          Native exchange authorization restricts markets and subaccounts, but
          does not enforce these spending caps. Aegis therefore uses protobuf
          exchange messages from a policy-controlled contract.
        </p>
        <h2>Spending and price accounting</h2>
        <p>
          Amounts use integer base units: USDT has 6 decimals, INJ has 18. A
          quote budget includes fees. Quantity rounds down to the market lot
          size with a 1% fee buffer. After the atomic exchange call, the
          contract verifies positive acquired INJ and a net quote debit within
          budget. Only then does it reserve the full authorized quote budget
          against the cumulative cap. A failure reverts the entire transaction.
        </p>
        <p>
          Unspent quote remains in the vault, but does not restore policy
          allowance. Deposits and withdrawals do not reset spending. Each
          explicitly created replacement policy begins a new mandate. Proposals
          use a hard maximum execution price; this is not a live price quote or
          a promise of liquidity.
        </p>
        <h2>Owner and agent trust</h2>
        <p>
          Owner actions are signed in Keplr. A separate testnet agent key is
          server-side. ADR-036 wallet authentication binds a short-lived session
          to the owner and application origin; requests validate vault ownership
          and the approved code ID. Agent transaction bytes and hashes are
          stored durably before broadcast. The AI provider only returns
          untrusted structured proposals and cannot authorize trades.
        </p>
        <h2>Try the demo</h2>
        <ol>
          <li>
            Open the <Link href="/app?demo=1">read-only dashboard</Link>.
          </li>
          <li>
            Inspect the sample 10 USDT per-order and 50 USDT cumulative limits.
          </li>
          <li>
            Open Agent console and inspect the 5 USDT preset, then the 25 USDT
            oversized preset.
          </li>
          <li>
            Open Policy and preview the revoked state. Return to the console to
            see its check fail.
          </li>
        </ol>
        <p>
          These are preset illustrations, not AI generations or transactions.
        </p>
        <h2>Connected testnet walkthrough</h2>
        <ol>
          <li>
            Connect Keplr on <code>injective-888</code>. Create a vault from the
            deployed code.
          </li>
          <li>
            Set one agent address, quote limits, expiry, and a maximum price.
            Review and sign the immutable policy.
          </li>
          <li>
            Fund your owner wallet and agent with testnet INJ for gas. Deposit
            supported testnet USDT into the vault.
          </li>
          <li>
            Sign in to create durable manual or AI proposals. Inspect the
            proposal and execute through the designated agent.
          </li>
          <li>
            Wait for the real receipt. Only a positive filled execution is
            labeled confirmed execution.
          </li>
          <li>
            Propose an oversized order to inspect a preflight rejection. This is
            not an onchain rejection.
          </li>
          <li>
            Revoke with your owner wallet and wait for confirmation. Further
            buys will fail the vault policy.
          </li>
          <li>
            Withdraw remaining INJ or USDT through the owner-only withdrawal
            action.
          </li>
        </ol>
        <h2>Network and assets</h2>
        <p>
          Chain: <code>injective-888</code>
          <br />
          Market: <code>{MARKET}</code>
        </p>
        <p>
          <a href={FAUCET}>Official INJ faucet ↗</a> ·{" "}
          <a href="https://chain.injective.network/testnet">
            Official network resources ↗
          </a>
        </p>
        <p>
          USDT funding may require an existing testnet account. Circle USDC and
          other testnet assets do not substitute for this market’s USDT denom.
          Never deposit mainnet assets.
        </p>
        <h2>Revocation and limitations</h2>
        <p>
          Revocation becomes effective when its transaction is included. A trade
          included earlier may complete, and past trades cannot be undone.
          Atomic buys create no resting orders. Market tick or fee changes can
          cause rejection. Public endpoints and testnet liquidity can be
          unavailable.
        </p>
        <p>
          Manual proposal inspection works without an AI key. Connected agent
          execution requires PostgreSQL, a session secret, deployed contract
          code, and a funded server agent. The{" "}
          <a href={`${GITHUB}/tree/main/docs/evidence`}>evidence directory</a>{" "}
          records actual checks and deployment receipts; absent evidence is not
          a verified integration.
        </p>
        <h2>Build, test, and inspect</h2>
        <p>
          The repository includes Rust contract source and tests, Next.js
          application source, deployment scripts, environment placeholders, and
          the implementation decision recorded before development.
        </p>
        <a className="button lime" href={GITHUB}>
          Open source & setup guide ↗
        </a>
      </main>
    </>
  );
}
