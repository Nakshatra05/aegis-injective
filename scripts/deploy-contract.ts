import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { gzipSync } from "node:zlib";
import { PrivateKey } from "@injectivelabs/sdk-ts/core/accounts";
import {
  MsgStoreCode,
  MsgInstantiateContract,
} from "@injectivelabs/sdk-ts/core/modules";
import { prepare, encodeTx, broadcastBytes } from "../src/lib/transactions";
import { receipt } from "../src/lib/chain";
import { createHash } from "node:crypto";
import { CHAIN_ID } from "../src/lib/config";
loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.DEPLOYER_PRIVATE_KEY)
    throw new Error("Set a funded testnet DEPLOYER_PRIVATE_KEY locally.");
  const key = PrivateKey.fromHex(process.env.DEPLOYER_PRIVATE_KEY);
  const owner = key.toBech32();
  const wasm = await readFile(
    "contracts/target/wasm32-unknown-unknown/release/aegis_vault.wasm",
  );
  async function submit(
    message: Parameters<typeof prepare>[2],
    gas: number,
    label: string,
  ) {
    const tx = await prepare(owner, key.toPublicKey().toBase64(), message, gas);
    tx.txRaw.signatures = [key.sign(tx.signBytes)];
    const bytes = encodeTx(tx.txRaw),
      hash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
    await mkdir("docs/evidence", { recursive: true });
    await writeFile(
      `docs/evidence/${label}-pending.json`,
      JSON.stringify({ hash, chain: CHAIN_ID, owner }, null, 2),
    );
    const sent = await broadcastBytes(Buffer.from(bytes).toString("base64"));
    if (sent.code !== 0) throw new Error(sent.raw_log);
    console.log(`${label}: ${hash}`);
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const r = await receipt(hash);
      if (r) {
        await writeFile(
          `docs/evidence/${label}-receipt.json`,
          JSON.stringify(r, null, 2),
        );
        if (r.code !== 0) throw new Error(r.raw_log);
        return r;
      }
    }
    throw new Error("Receipt pending. Reconcile saved hash before rerunning.");
  }
  const stored = await submit(
    MsgStoreCode.fromJSON({ sender: owner, wasmBytes: gzipSync(wasm) }),
    4_000_000,
    "store-code",
  );
  const codeId = stored.events
    .flatMap((e) => e.attributes)
    .find((a) => a.key === "code_id")?.value;
  if (!codeId) throw new Error("No code_id event");
  const instantiated = await submit(
    MsgInstantiateContract.fromJSON({
      sender: owner,
      admin: "",
      codeId: Number(codeId),
      label: "Aegis verified testnet vault",
      msg: {},
    }),
    600000,
    "instantiate",
  );
  const address = instantiated.events
    .flatMap((e) => e.attributes)
    .find((a) => a.key === "_contract_address")?.value;
  if (!address) throw new Error("No contract address event");
  const deployment = {
    chain: CHAIN_ID,
    codeId,
    address,
    owner,
    wasmSha256: createHash("sha256").update(wasm).digest("hex"),
    verifiedAt: new Date().toISOString(),
  };
  await writeFile(
    "docs/evidence/deployment.json",
    JSON.stringify(deployment, null, 2),
  );
  console.log(JSON.stringify(deployment, null, 2));
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Deployment failed");
  process.exitCode = 1;
});
