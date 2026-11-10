// Generates fresh TESTNET-ONLY accounts. Never prints or commits private keys.
import { PrivateKey } from "@injectivelabs/sdk-ts/core/accounts";
import { writeFile, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
let existing = "";
try {
  existing = await readFile(".env.local", "utf8");
} catch {}
if (existing.includes("DEPLOYER_PRIVATE_KEY=")) {
  console.log("Local test accounts already exist. No keys changed.");
  process.exit(0);
}
const deployer = PrivateKey.fromHex(randomBytes(32).toString("hex")),
  agent = PrivateKey.fromHex(randomBytes(32).toString("hex"));
await writeFile(
  ".env.local",
  `${existing}\nDEPLOYER_PRIVATE_KEY=${deployer.toHex()}\nAGENT_PRIVATE_KEY=${agent.toHex()}\nNEXT_PUBLIC_AGENT_ADDRESS=${agent.toBech32()}\nSESSION_SECRET=${randomBytes(48).toString("hex")}\nAPP_ORIGIN=http://localhost:3000\n`,
  { mode: 0o600 },
);
const addresses = {
  chain: "injective-888",
  deployer: deployer.toBech32(),
  agent: agent.toBech32(),
};
await writeFile(
  "docs/evidence/test-accounts.json",
  JSON.stringify(addresses, null, 2),
);
console.log(JSON.stringify(addresses));
