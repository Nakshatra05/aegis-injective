import { writeFile, mkdir } from "node:fs/promises";
import { IndexerGrpcSpotApi } from "@injectivelabs/sdk-ts/client/indexer";
import { CHAIN_ID, INDEXER, MARKET, LCD } from "../src/lib/config";
import { chainClock, jsonFetch } from "../src/lib/chain";
async function main() {
  const clock = await chainClock();
  const markets = await jsonFetch<{ markets: Record<string, unknown>[] }>(
    `${LCD}/injective/exchange/v1beta1/spot/markets`,
  );
  const market = markets.markets.find((m) => m.market_id === MARKET);
  if (!market) throw new Error("Expected market absent");
  const indexer = new IndexerGrpcSpotApi(INDEXER);
  let orderbook: unknown;
  try {
    orderbook = await indexer.fetchOrderbookV2(MARKET);
  } catch (e) {
    orderbook = {
      error: e instanceof Error ? e.message : "Indexer unavailable",
    };
  }
  const result = {
    verifiedAt: new Date().toISOString(),
    chain: CHAIN_ID,
    clock,
    market,
    orderbook,
  };
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/network.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
