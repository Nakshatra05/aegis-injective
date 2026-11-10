import { PrivateKey } from "@injectivelabs/sdk-ts/core/accounts";
import { MsgExecuteContractCompat } from "@injectivelabs/sdk-ts/core/modules";
import { createHash } from "node:crypto";
import { prepare, encodeTx } from "../transactions";
import { positive } from "../amount";
import type { Proposal } from "../proposal";
export interface AgentSigner {
  address(): string;
  sign(
    vault: string,
    policyId: number,
    nonce: number,
    p: Proposal,
  ): Promise<{ hash: string; bytes: string }>;
}
export class InjectiveAgentSigner implements AgentSigner {
  private key: PrivateKey;
  constructor() {
    if (!process.env.AGENT_PRIVATE_KEY)
      throw new Error("Testnet agent signer is not configured.");
    this.key = PrivateKey.fromHex(process.env.AGENT_PRIVATE_KEY);
  }
  address() {
    return this.key.toBech32();
  }
  async sign(vault: string, policyId: number, nonce: number, p: Proposal) {
    const message = MsgExecuteContractCompat.fromJSON({
      sender: this.address(),
      contractAddress: vault,
      msg: {
        buy: {
          policy_id: policyId,
          nonce,
          market: p.market,
          direction: p.direction,
          quote_budget: positive(p.quoteAmount),
          limit_price: positive(p.limitPrice),
        },
      },
    });
    const tx = await prepare(
      this.address(),
      this.key.toPublicKey().toBase64(),
      message,
    );
    tx.txRaw.signatures = [this.key.sign(tx.signBytes)];
    const bytes = encodeTx(tx.txRaw);
    return {
      hash: createHash("sha256").update(bytes).digest("hex").toUpperCase(),
      bytes: Buffer.from(bytes).toString("base64"),
    };
  }
}
