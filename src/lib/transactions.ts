import { BaseAccount } from "@injectivelabs/sdk-ts/core/accounts";
import { ChainRestAuthApi } from "@injectivelabs/sdk-ts/client/chain";
import { createTransaction } from "@injectivelabs/sdk-ts/core/tx";
import type { Msgs } from "@injectivelabs/sdk-ts/core/modules";
import { CosmosTxV1Beta1TxPb } from "@injectivelabs/sdk-ts/proto/cosmos-tx";
import { CHAIN_ID, LCD } from "./config";
import { chainClock } from "./chain";
export async function prepare(
  address: string,
  pubKey: string,
  message: Msgs,
  gas = 500000,
) {
  const clock = await chainClock();
  const account = BaseAccount.fromRestApi(
    await new ChainRestAuthApi(LCD).fetchAccount(address),
  ).toAccountDetails();
  return createTransaction({
    message,
    chainId: CHAIN_ID,
    pubKey,
    accountNumber: account.accountNumber,
    sequence: account.sequence,
    timeoutHeight: Number(clock.height) + 100,
    fee: {
      amount: [{ denom: "inj", amount: (BigInt(gas) * 500000000n).toString() }],
      gas: String(gas),
    },
  });
}
export function encodeTx(
  tx: Parameters<typeof CosmosTxV1Beta1TxPb.TxRaw.toBinary>[0],
) {
  return CosmosTxV1Beta1TxPb.TxRaw.toBinary(tx);
}
export async function broadcastBytes(base64: string) {
  const r = await fetch(`${LCD}/cosmos/tx/v1beta1/txs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx_bytes: base64, mode: "BROADCAST_MODE_SYNC" }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new Error(
      "Broadcast outcome unknown; check the saved transaction hash before retrying.",
    );
  const body = await r.json();
  const result = body.tx_response as {
    code: number;
    txhash: string;
    raw_log: string;
  };
  if (!result)
    throw new Error(
      "Broadcast response unavailable; use saved transaction hash.",
    );
  return result;
}
