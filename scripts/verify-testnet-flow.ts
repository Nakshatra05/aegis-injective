import { readFile, writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { PrivateKey } from "@injectivelabs/sdk-ts/core/accounts";
import { MsgExecuteContractCompat } from "@injectivelabs/sdk-ts/core/modules";
import { createHash } from "node:crypto";
import { prepare, encodeTx, broadcastBytes } from "../src/lib/transactions";
import { chainClock, receipt, vaultState, balances } from "../src/lib/chain";
import { CHAIN_ID, MARKET, QUOTE } from "../src/lib/config";
loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.DEPLOYER_PRIVATE_KEY || !process.env.AGENT_PRIVATE_KEY)
    throw new Error("Funded testnet owner/deployer and agent keys required.");
  const deployment = JSON.parse(
    await readFile("docs/evidence/deployment.json", "utf8"),
  ) as { address: string; chain: string };
  if (deployment.chain !== CHAIN_ID)
    throw new Error("Testnet evidence required.");
  const owner = PrivateKey.fromHex(process.env.DEPLOYER_PRIVATE_KEY),
    agent = PrivateKey.fromHex(process.env.AGENT_PRIVATE_KEY),
    vault = deployment.address;
  const current = await vaultState(vault);
  if (current.owner !== owner.toBech32() || current.policy)
    throw new Error(
      "Use a fresh verification vault owned by the configured deployer. This script will not overwrite an existing mandate.",
    );
  async function send(
    key: PrivateKey,
    msg: Record<string, unknown>,
    label: string,
    funds?: { denom: string; amount: string }[],
    expectFailure = false,
  ) {
    const tx = await prepare(
      key.toBech32(),
      key.toPublicKey().toBase64(),
      MsgExecuteContractCompat.fromJSON({
        sender: key.toBech32(),
        contractAddress: vault,
        msg,
        funds,
      }),
      600000,
    );
    tx.txRaw.signatures = [key.sign(tx.signBytes)];
    const bytes = encodeTx(tx.txRaw),
      hash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
    await writeFile(
      `docs/evidence/${label}-pending.json`,
      JSON.stringify({ chain: CHAIN_ID, vault, hash }, null, 2),
    );
    const sent = await broadcastBytes(Buffer.from(bytes).toString("base64"));
    if (sent.code !== 0)
      throw new Error(
        `${label}: rejected before inclusion; NOT an onchain failure: ${sent.raw_log}`,
      );
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const r = await receipt(hash);
      if (!r) continue;
      await writeFile(
        `docs/evidence/${label}-receipt.json`,
        JSON.stringify(r, null, 2),
      );
      if ((r.code !== 0) !== expectFailure)
        throw new Error(
          `${label}: unexpected chain result ${r.code}: ${r.raw_log}`,
        );
      console.log(`${label}: ${hash} · code ${r.code}`);
      return r;
    }
    throw new Error(
      `${label}: pending; reconcile saved hash before continuing`,
    );
  }
  const clock = await chainClock();
  await send(
    owner,
    {
      create_policy: {
        agent: agent.toBech32(),
        per_order: "10000000",
        cap: "10000000",
        expires_at: clock.time + 86400,
        max_price: "10000000",
      },
    },
    "policy",
  );
  await send(owner, { deposit: {} }, "fund-vault", [
    { denom: QUOTE, amount: "10000000" },
  ]);
  const buy = (budget: string, nonce: number) => ({
    buy: {
      policy_id: 1,
      nonce,
      market: MARKET,
      direction: "buy",
      quote_budget: budget,
      limit_price: "10000000",
    },
  });
  // No simulation: these are actual included transactions or an explicit failure.
  await send(agent, buy("5000000", 0), "allowed-buy");
  const after = await vaultState(vault);
  if (after.policy?.spent !== "5000000" || after.policy.next_nonce !== 1)
    throw new Error("Successful execution accounting mismatch");
  const acquired = (await balances(vault)).find(
    (c) => c.denom === "inj",
  )?.amount;
  if (!acquired || BigInt(acquired) <= 0n)
    throw new Error("No positive acquired INJ; do not claim a fill");
  await send(agent, buy("11000000", 1), "oversized-onchain", undefined, true);
  await send(
    owner,
    { withdraw: { denom: QUOTE, amount: "1000000" } },
    "owner-withdrawal",
  );
  if ((await vaultState(vault)).policy?.spent !== "5000000")
    throw new Error("Withdrawal changed spending");
  await send(owner, { revoke: { policy_id: 1 } }, "revocation");
  await send(agent, buy("5000000", 1), "revoked-onchain", undefined, true);
  await writeFile(
    "docs/evidence/testnet-flow.json",
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        chain: CHAIN_ID,
        vault,
        acquiredInjBaseUnits: acquired,
        state: await vaultState(vault),
        balances: await balances(vault),
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Verification failed");
  process.exitCode = 1;
});
