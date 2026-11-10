import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, session, ownedVault } from "@/lib/server/auth";
import { schema, db, record } from "@/lib/server/db";
import { InjectiveAgentSigner } from "@/lib/server/agent";
import { proposalSchema, preflight } from "@/lib/proposal";
import { chainClock } from "@/lib/chain";
import { broadcastBytes } from "@/lib/transactions";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const owner = await session();
    const { id } = z
      .object({ id: z.string().uuid() })
      .strict()
      .parse(await request.json());
    await schema();
    const rows =
      await db()`SELECT * FROM aegis_activity WHERE id=${id} AND owner=${owner} AND kind='proposal'`;
    const row = rows[0];
    if (!row) throw new Error("No executable proposal owned by this session.");
    const proposal = proposalSchema.parse(row.payload.proposal);
    const state = await ownedVault(row.vault, owner);
    const signer = new InjectiveAgentSigner();
    const clock = await chainClock();
    const checks = preflight(
      state.policy,
      proposal,
      clock.time,
      signer.address(),
    );
    if (
      !state.policy ||
      state.policy.id !== row.payload.policyId ||
      state.policy.next_nonce !== row.payload.nonce ||
      !checks.every((c) => c.ok)
    ) {
      await record({
        owner,
        vault: row.vault,
        kind: "preflight_rejection",
        summary: row.summary,
        reason: "Policy, nonce, or limits changed. Propose again.",
      });
      throw new Error("Preflight rejected: policy, nonce, or limits changed.");
    }
    // Serialize all signing by this deployment in PostgreSQL, including sequence lookup.
    // Keep signed bytes/hash durably before network mutation. A timeout cannot lose the hash.
    const signed = await db().begin(async (sql) => {
      await sql`SELECT pg_advisory_xact_lock(19770101)`;
      const existing =
        await sql`SELECT * FROM aegis_execution WHERE vault=${row.vault} AND policy_id=${state.policy!.id} AND nonce=${state.policy!.next_nonce}`;
      if (existing.length)
        throw new Error(
          "This policy nonce already has an execution. Inspect activity before retrying.",
        );
      const active =
        await sql`SELECT tx_hash FROM aegis_execution WHERE status IN ('prepared','submitted','broadcast_unknown') LIMIT 1`;
      if (active.length)
        throw new Error(
          "Agent has a pending execution. Refresh activity to reconcile it before another trade.",
        );
      const tx = await signer.sign(
        row.vault,
        state.policy!.id,
        state.policy!.next_nonce,
        proposal,
      );
      await sql`INSERT INTO aegis_execution(vault,policy_id,nonce,proposal_id,tx_hash,tx_bytes,status) VALUES(${row.vault},${state.policy!.id},${state.policy!.next_nonce},${id},${tx.hash},${tx.bytes},'prepared')`;
      await sql`INSERT INTO aegis_activity(id,owner,vault,kind,summary,tx_hash,payload) VALUES(${crypto.randomUUID()},${owner},${row.vault},'submitted',${row.summary},${tx.hash},${JSON.stringify({ proposal, policyId: state.policy!.id, nonce: state.policy!.next_nonce })}::jsonb)`;
      return tx;
    });
    try {
      const result = await broadcastBytes(signed.bytes);
      if (result.code !== 0) {
        await db()`DELETE FROM aegis_execution WHERE tx_hash=${signed.hash}`;
        await db()`UPDATE aegis_activity SET kind='preflight_rejection',reason=${"Node CheckTx rejected before inclusion: " + result.raw_log} WHERE tx_hash=${signed.hash}`;
        return NextResponse.json(
          {
            hash: signed.hash,
            error: "Node rejected before inclusion: " + result.raw_log,
          },
          { status: 400 },
        );
      }
      await db()`UPDATE aegis_execution SET status='submitted' WHERE tx_hash=${signed.hash}`;
    } catch {
      await db()`UPDATE aegis_execution SET status='broadcast_unknown' WHERE tx_hash=${signed.hash}`;
      return NextResponse.json(
        {
          hash: signed.hash,
          status: "broadcast_unknown",
          message:
            "Broadcast outcome unknown. Saved transaction hash will be reconciled on refresh.",
        },
        { status: 202 },
      );
    }
    return NextResponse.json({ hash: signed.hash, status: "submitted" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Execution failed" },
      { status: 400 },
    );
  }
}
