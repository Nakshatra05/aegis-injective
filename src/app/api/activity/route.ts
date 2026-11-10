import { NextResponse } from "next/server";
import { session, ownedVault } from "@/lib/server/auth";
import { schema, db } from "@/lib/server/db";
import { receipt } from "@/lib/chain";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const owner = await session();
    const vault = new URL(request.url).searchParams.get("vault") ?? "";
    await ownedVault(vault, owner);
    await schema();
    const pending =
      await db()`SELECT tx_hash FROM aegis_activity WHERE owner=${owner} AND vault=${vault} AND kind IN ('submitted','broadcast_unknown') AND tx_hash IS NOT NULL LIMIT 10`;
    for (const item of pending) {
      try {
        const r = await receipt(item.tx_hash);
        if (!r) continue;
        const executed =
          r.code === 0 &&
          r.events?.some(
            (e) =>
              e.type === "wasm" &&
              e.attributes.some(
                (a) => a.key === "action" && a.value === "executed",
              ) &&
              e.attributes.some(
                (a) => a.key === "_contract_address" && a.value === vault,
              ),
          );
        const kind =
          r.code !== 0
            ? "onchain_failure"
            : executed
              ? "confirmed_execution"
              : "confirmed_transaction";
        await db()`UPDATE aegis_activity SET kind=${kind},reason=${r.code !== 0 ? r.raw_log : null} WHERE tx_hash=${item.tx_hash} AND owner=${owner}`;
        if (r.code !== 0) {
          await db()`DELETE FROM aegis_execution WHERE tx_hash=${item.tx_hash}`;
        } else {
          await db()`UPDATE aegis_execution SET status=${kind},tx_bytes=NULL WHERE tx_hash=${item.tx_hash}`;
        }
      } catch {
        /* Keep unknown transactions pending. */
      }
    }
    const rows =
      await db()`SELECT id,owner,vault,kind,summary,reason,tx_hash,created_at,payload FROM aegis_activity WHERE owner=${owner} AND vault=${vault} ORDER BY created_at DESC LIMIT 100`;
    return NextResponse.json({ activity: rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Activity unavailable" },
      { status: 400 },
    );
  }
}
