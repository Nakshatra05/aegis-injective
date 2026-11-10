import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { PublicKey, PrivateKey } from "@injectivelabs/sdk-ts/core/accounts";
import { generateArbitrarySignDoc } from "@injectivelabs/sdk-ts/core/tx";
import { CHAIN_ID, LCD } from "../config";
import { jsonFetch, vaultState } from "../chain";
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new Error("Session authentication is not configured.");
  return s;
}
export function sameOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN;
  if (!expected || request.headers.get("origin") !== new URL(expected).origin)
    throw new Error("Origin not authorized.");
}
export function token(owner: string) {
  const raw = Buffer.from(
    JSON.stringify({
      owner,
      chain: CHAIN_ID,
      exp: Date.now() + 3600_000,
      id: crypto.randomUUID(),
    }),
  ).toString("base64url");
  return `${raw}.${createHmac("sha256", secret()).update(raw).digest("base64url")}`;
}
export async function session() {
  const value = (await cookies()).get("aegis_session")?.value;
  if (!value) throw new Error("Sign in with your owner wallet.");
  const [raw, mac] = value.split(".");
  const actual = createHmac("sha256", secret()).update(raw).digest();
  const provided = Buffer.from(mac ?? "", "base64url");
  if (actual.length !== provided.length || !timingSafeEqual(actual, provided))
    throw new Error("Invalid session.");
  const p = JSON.parse(Buffer.from(raw, "base64url").toString()) as {
    owner: string;
    chain: string;
    exp: number;
  };
  if (p.chain !== CHAIN_ID || p.exp < Date.now())
    throw new Error("Session expired. Sign in again.");
  return p.owner;
}
export function verifyOwnerSignature(
  owner: string,
  message: string,
  signature: { pub_key: { value: string }; signature: string },
) {
  const publicKey = PublicKey.fromBase64(signature.pub_key.value);
  if (publicKey.toAddress().toBech32() !== owner)
    throw new Error("Signature owner mismatch.");
  const { signDocBuff } = generateArbitrarySignDoc(message, owner);
  if (
    !PrivateKey.verifyArbitrarySignature({
      signature: Buffer.from(signature.signature, "base64").toString("hex"),
      signDoc: signDocBuff,
      publicKey: publicKey.toHex(),
    })
  )
    throw new Error("Invalid wallet signature.");
}
export async function ownedVault(vault: string, owner: string) {
  const state = await vaultState(vault);
  if (state.owner !== owner)
    throw new Error("Connected wallet does not own this vault.");
  const metadata = await jsonFetch<{
    contract_info: { code_id: string; admin: string };
  }>(`${LCD}/cosmwasm/wasm/v1/contract/${vault}`);
  if (
    !process.env.NEXT_PUBLIC_VAULT_CODE_ID ||
    String(metadata.contract_info.code_id) !==
      process.env.NEXT_PUBLIC_VAULT_CODE_ID ||
    metadata.contract_info.admin
  )
    throw new Error("Vault code is unverified or upgradeable.");
  return state;
}
