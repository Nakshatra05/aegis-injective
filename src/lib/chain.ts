import { LCD, RPC, CHAIN_ID, type VaultState } from "./config";
export async function jsonFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      `Network request failed (${response.status}). Retry shortly.`,
    );
  return response.json() as Promise<T>;
}
export async function chainClock() {
  const data = await jsonFetch<{
    result: {
      node_info: { network: string };
      sync_info: {
        latest_block_time: string;
        latest_block_height: string;
        catching_up: boolean;
      };
    };
  }>(`${RPC}/status`);
  if (
    data.result.node_info.network !== CHAIN_ID ||
    data.result.sync_info.catching_up
  )
    throw new Error("Testnet node is not ready or reports the wrong chain.");
  return {
    time: Math.floor(
      Date.parse(data.result.sync_info.latest_block_time) / 1000,
    ),
    height: data.result.sync_info.latest_block_height,
  };
}
export async function vaultState(address: string): Promise<VaultState> {
  if (!/^inj1[a-z0-9]{38}$/.test(address))
    throw new Error("Invalid Injective vault address.");
  const query =
    typeof window === "undefined"
      ? Buffer.from('{"state":{}}').toString("base64")
      : btoa('{"state":{}}');
  const result = await jsonFetch<{ data: VaultState }>(
    `${LCD}/cosmwasm/wasm/v1/contract/${address}/smart/${encodeURIComponent(query)}`,
  );
  if (result.data.chain !== CHAIN_ID) throw new Error("Vault chain mismatch.");
  return result.data;
}
export async function balances(address: string) {
  return (
    await jsonFetch<{ balances: { denom: string; amount: string }[] }>(
      `${LCD}/cosmos/bank/v1beta1/balances/${address}`,
    )
  ).balances;
}
export async function receipt(hash: string) {
  if (!/^[A-Fa-f0-9]{64}$/.test(hash))
    throw new Error("Invalid transaction hash.");
  const response = await fetch(`${LCD}/cosmos/tx/v1beta1/txs/${hash}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error("Receipt lookup unavailable. Transaction remains pending.");
  const data = await response.json();
  return data.tx_response as {
    code: number;
    raw_log: string;
    txhash: string;
    events: { type: string; attributes: { key: string; value: string }[] }[];
  };
}
