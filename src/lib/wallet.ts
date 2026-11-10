"use client";
import { CHAIN_ID, RPC, LCD } from "./config";
import { prepare, encodeTx, broadcastBytes } from "./transactions";
import type { Msgs } from "@injectivelabs/sdk-ts/core/modules";
type SignDoc = Awaited<ReturnType<typeof prepare>>["signDoc"];
type Keplr = {
  enable: (chain: string) => Promise<void>;
  experimentalSuggestChain: (config: object) => Promise<void>;
  getKey: (
    chain: string,
  ) => Promise<{ bech32Address: string; pubKey: Uint8Array }>;
  signDirect: (
    chain: string,
    address: string,
    doc: SignDoc,
  ) => Promise<{ signed: SignDoc; signature: { signature: string } }>;
  signArbitrary: (
    chain: string,
    address: string,
    message: string,
  ) => Promise<{ pub_key: { type: string; value: string }; signature: string }>;
};
function wallet(): Keplr {
  const k = (window as unknown as { keplr?: Keplr }).keplr;
  if (!k)
    throw new Error(
      "Keplr is not installed. Install the Keplr browser extension, then reload.",
    );
  return k;
}
function base64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}
export async function connect() {
  const k = wallet();
  try {
    await k.enable(CHAIN_ID);
  } catch {
    await k.experimentalSuggestChain({
      chainId: CHAIN_ID,
      chainName: "Injective Testnet",
      rpc: RPC,
      rest: LCD,
      bip44: { coinType: 60 },
      bech32Config: {
        bech32PrefixAccAddr: "inj",
        bech32PrefixAccPub: "injpub",
        bech32PrefixValAddr: "injvaloper",
        bech32PrefixValPub: "injvaloperpub",
        bech32PrefixConsAddr: "injvalcons",
        bech32PrefixConsPub: "injvalconspub",
      },
      currencies: [
        { coinDenom: "INJ", coinMinimalDenom: "inj", coinDecimals: 18 },
      ],
      feeCurrencies: [
        {
          coinDenom: "INJ",
          coinMinimalDenom: "inj",
          coinDecimals: 18,
          gasPriceStep: {
            low: 500000000,
            average: 700000000,
            high: 1000000000,
          },
        },
      ],
      stakeCurrency: {
        coinDenom: "INJ",
        coinMinimalDenom: "inj",
        coinDecimals: 18,
      },
      features: ["eth-address-gen", "eth-key-sign"],
    });
    await k.enable(CHAIN_ID);
  }
  return (await k.getKey(CHAIN_ID)).bech32Address;
}
export async function ownerTx(
  owner: string,
  message: Msgs,
  onSigned: (hash: string) => void,
  onRejected?: (hash: string, reason: string) => void,
) {
  const k = wallet();
  const key = await k.getKey(CHAIN_ID);
  if (key.bech32Address !== owner)
    throw new Error("Wallet account changed. Reconnect before signing.");
  const tx = await prepare(owner, base64(key.pubKey), message, 600000);
  const signed = await k.signDirect(CHAIN_ID, owner, tx.signDoc);
  const raw = {
    bodyBytes: signed.signed.bodyBytes,
    authInfoBytes: signed.signed.authInfoBytes,
    signatures: [
      Uint8Array.from(atob(signed.signature.signature), (c) => c.charCodeAt(0)),
    ],
  };
  const bytes = encodeTx(raw);
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
  onSigned(hash);
  const result = await broadcastBytes(base64(bytes));
  if (result.code !== 0) {
    onRejected?.(hash, result.raw_log);
    throw new Error(`Broadcast rejected: ${result.raw_log}`);
  }
  return hash;
}
export async function login(owner: string) {
  const first = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner }),
  });
  const challenge = await first.json();
  if (!first.ok) throw new Error(challenge.error);
  const signature = await wallet().signArbitrary(
    CHAIN_ID,
    owner,
    challenge.message,
  );
  const result = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner, id: challenge.id, signature }),
  });
  const body = await result.json();
  if (!result.ok) throw new Error(body.error);
}
