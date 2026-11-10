import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Crosshair,
  Gauge,
  Wallet,
  Timer,
  OctagonX,
  ScanLine,
  Check,
  X,
  MoveUpRight,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { GITHUB } from "@/lib/config";
const features = [
  {
    icon: Crosshair,
    title: "Approved markets",
    text: "One clear playing field. Your agent can only buy on the market you authorize.",
  },
  {
    icon: Gauge,
    title: "Per-order limits",
    text: "Small trades stay small. Put a hard ceiling on every quote budget.",
  },
  {
    icon: Wallet,
    title: "Cumulative spending caps",
    text: "Set the total mandate. Deposits and refunds never reset what was spent.",
  },
  {
    icon: Timer,
    title: "Permission expiry",
    text: "Give access an end date. Chain time decides when the mandate expires.",
  },
  {
    icon: OctagonX,
    title: "Instant revocation",
    text: "Revoke with your wallet. Once confirmed, the next execution is blocked.",
  },
  {
    icon: ScanLine,
    title: "Auditable activity",
    text: "See proposals, preflight checks, submissions, and real chain outcomes separately.",
  },
];
export default function Home() {
  return (
    <>
      <nav className="nav">
        <Brand />
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
          <a href={GITHUB}>
            GitHub <ArrowUpRight size={14} />
          </a>
        </div>
        <Link className="button small lime" href="/app">
          Launch app <ArrowUpRight size={17} />
        </Link>
      </nav>
      <main id="main">
        <section className="hero grid-paper">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="live-dot" /> BUILT FOR INJECTIVE · TESTNET MVP
            </span>
            <h1>
              Give agents
              <br />
              <span className="highlight">limits.</span>
              <br />
              Keep control<span className="blue-text">.</span>
            </h1>
            <p>
              Delegate trading on Injective with enforceable permissions,
              spending caps, and instant revocation.
            </p>
            <div className="actions">
              <Link className="button lime" href="/app">
                Launch Aegis <ArrowUpRight />
              </Link>
              <Link className="text-link" href="/app?demo=1">
                Explore the demo <ArrowRight size={18} />
              </Link>
            </div>
            <div className="hero-note">
              <ShieldCheck size={17} /> Your keys. Your rules. Enforced onchain.
            </div>
          </div>
          <div className="hero-art">
            <div className="orbit-label">AUTONOMY, WITH BOUNDARIES.</div>
            <div className="policy-preview panel">
              <div className="preview-top">
                <span>YOUR AGENT’S MANDATE</span>
                <span className="badge blue">SAMPLE DATA</span>
              </div>
              <div className="preview-name">
                <div className="bot-mark">
                  A<span>01</span>
                </div>
                <div>
                  <h3>Spot buyer</h3>
                  <p>One agent. A defined mandate.</p>
                </div>
                <span className="status-dot" />
              </div>
              <div className="preview-market">
                <span>APPROVED MARKET</span>
                <strong>
                  INJ <span className="muted">/</span> USDT <ArrowUpRight />
                </strong>
                <span className="badge">SPOT · BUY ONLY</span>
              </div>
              <div className="preview-limits">
                <div>
                  <span>PER ORDER</span>
                  <strong>
                    10 <small>USDT</small>
                  </strong>
                </div>
                <div>
                  <span>TOTAL CAP</span>
                  <strong>
                    50 <small>USDT</small>
                  </strong>
                </div>
              </div>
              <div className="allowance">
                <span>Remaining allowance</span>
                <strong>45 / 50 USDT</strong>
              </div>
              <div className="meter">
                <span style={{ width: "90%" }} />
              </div>
              <div className="preview-rule">
                <Check size={18} /> Buy 5 USDT of INJ <span>PERMITTED</span>
              </div>
              <div className="preview-rule blocked">
                <X size={18} /> Buy 25 USDT of INJ <span>BLOCKED</span>
              </div>
              <div className="preview-foot">
                ILLUSTRATIVE POLICY · NO LIVE TRANSACTIONS
              </div>
            </div>
            <div className="enforcement-stamp">
              <ShieldCheck size={28} />
              <span>
                AI PROPOSES.
                <br />
                RULES DECIDE.
              </span>
            </div>
          </div>
        </section>
        <div className="ticker-strip">
          <span>DEFINED PERMISSIONS</span>
          <span>✳</span>
          <span>DETERMINISTIC ENFORCEMENT</span>
          <span>✳</span>
          <span>OWNER CONTROL</span>
          <span>✳</span>
          <span>TESTNET ONLY</span>
        </div>
        <section className="section" id="how-it-works">
          <div className="section-heading">
            <div>
              <span className="eyebrow">01 / THE WORKFLOW</span>
              <h2>
                Delegate the trade.
                <br />
                Keep the decisions.
              </h2>
            </div>
            <p>
              A clear mandate from the first signature
              <br />
              to the last permitted transaction.
            </p>
          </div>
          <div className="steps">
            {[
              [
                "01",
                "Define your mandate.",
                "Choose your agent, set a spending cap, and decide when access ends. Review everything before signing.",
              ],
              [
                "02",
                "Let your agent propose trades.",
                "Describe a buy in plain language, or enter it manually. Inspect the structured proposal and its price bound.",
              ],
              [
                "03",
                "Enforce limits before execution.",
                "The vault checks every request onchain. Out-of-policy actions fail. Every outcome stays inspectable.",
              ],
            ].map(([n, title, text]) => (
              <article key={n}>
                <span className="step-number">{n}</span>
                <MoveUpRight size={28} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="section features-section" id="features">
          <div className="section-heading">
            <div>
              <span className="eyebrow">02 / THE GUARDRAILS</span>
              <h2>Trust needs boundaries.</h2>
            </div>
            <span className="badge lime">SIX LIMITS. ONE MANDATE.</span>
          </div>
          <div className="features">
            {features.map(({ icon: Icon, title, text }, i) => (
              <article className="feature" key={title}>
                <div className="feature-top">
                  <Icon size={27} />
                  <span>0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="section">
          <div className="enforcement">
            <div>
              <span className="eyebrow">
                03 / A CLEAR DIVISION OF RESPONSIBILITY
              </span>
              <h2>
                Intelligence proposes.
                <br />
                <span>Code enforces.</span>
              </h2>
              <p>
                An AI model can help interpret a request. It cannot grant itself
                permission. The vault checks identity, limits, expiry, nonce,
                and price before an atomic spot buy can settle.
              </p>
              <Link className="button lime" href="/docs">
                Read the architecture <ArrowUpRight />
              </Link>
            </div>
            <div className="flow">
              <div>
                <span>01</span> UNTRUSTED PROPOSAL <ArrowRight />
              </div>
              <div className="lime">
                <ShieldCheck /> ONCHAIN POLICY CHECK <ArrowRight />
              </div>
              <div>
                <span>03</span> EXECUTE OR REJECT <ArrowRight />
              </div>
              <p>No unrestricted keys. No arbitrary contract calls.</p>
            </div>
          </div>
        </section>
        <section className="scope section">
          <div>
            <span className="eyebrow">A FOCUSED FIRST VERSION</span>
            <h2>
              Small scope.
              <br />
              Real boundaries.
            </h2>
          </div>
          <div>
            <span className="badge orange">TESTNET MVP · NOT AUDITED</span>
            <p>
              Built for one wallet integration, one INJ/USDT spot market, and
              one agent per policy. Quote-denominated atomic buys only. Testnet
              assets have no intended monetary value.
            </p>
            <p>
              Live execution requires a deployed vault, funded testnet accounts,
              and configured server services. The read-only demo is always
              clearly labeled.
            </p>
            <Link href="/docs" className="text-link">
              View implementation and deployment status{" "}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <section className="section faq" id="faq">
          <div>
            <span className="eyebrow">GOOD QUESTIONS</span>
            <h2>Know the limits.</h2>
          </div>
          <div>
            {[
              [
                "Does my agent get my private key?",
                "No. Your wallet signs owner actions. A separate agent key can only submit buys through the policy-controlled vault. It cannot withdraw your vault assets.",
              ],
              [
                "What happens when I revoke?",
                "Revocation blocks new executions after its transaction confirms. An execution already included before revocation may complete. Confirmed trades cannot be undone.",
              ],
              [
                "Can I change a policy?",
                "Policies are immutable. Revoke the existing policy and explicitly create a new one to change the agent, limits, expiry, or maximum price.",
              ],
              [
                "What if the AI gets it wrong?",
                "Proposals are untrusted, schema-validated suggestions. You can inspect them or use manual entry. Only deterministic onchain rules authorize a trade.",
              ],
              [
                "Does a successful submission mean my trade filled?",
                "No. A submitted transaction stays pending until its receipt is available. Only a confirmed execution with acquired base assets is shown as a completed trade.",
              ],
              [
                "Is this ready for real funds?",
                "No. Aegis is a testnet MVP, has not been audited, and must not be used with mainnet assets.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="bottom-cta">
          <span className="eyebrow">YOUR AGENT. YOUR MANDATE.</span>
          <h2>
            Let it trade.
            <br />
            On your terms.
          </h2>
          <Link className="button black" href="/app">
            Launch Aegis <ArrowUpRight />
          </Link>
        </section>
      </main>
      <footer>
        <Brand />
        <p>Give agents limits. Keep control.</p>
        <div>
          <a href={GITHUB}>GitHub ↗</a>
          <Link href="/docs">Documentation ↗</Link>
          <Link href="/docs#deployment">Contract status ↗</Link>
        </div>
        <span>© 2026 Aegis · Injective testnet</span>
      </footer>
    </>
  );
}
