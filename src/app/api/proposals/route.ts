import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, session, ownedVault } from "@/lib/server/auth";
import { record } from "@/lib/server/db";
import { OpenAIProposalProvider } from "@/lib/server/ai";
import { proposalSchema, preflight } from "@/lib/proposal";
import { chainClock } from "@/lib/chain";
export const runtime = "nodejs";
export const maxDuration = 60;
const input = z
  .object({
    vault: z.string().max(100),
    proposal: proposalSchema.optional(),
    prompt: z.string().min(1).max(1000).optional(),
    limitPrice: z.string().max(45).optional(),
  })
  .strict();
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const owner = await session();
    const p = input.parse(await request.json());
    const state = await ownedVault(p.vault, owner);
    const proposal =
      p.proposal ??
      (await new OpenAIProposalProvider().propose(
        p.prompt ?? "",
        p.limitPrice ?? "",
      ));
    const clock = await chainClock();
    const checks = preflight(
      state.policy,
      proposal,
      clock.time,
      process.env.NEXT_PUBLIC_AGENT_ADDRESS,
    );
    const valid = checks.every((c) => c.ok);
    const reason = checks
      .filter((c) => !c.ok)
      .map((c) => c.label)
      .join("; ");
    const id = await record({
      owner,
      vault: p.vault,
      kind: valid ? "proposal" : "preflight_rejection",
      summary: `Buy ${proposal.quoteAmount} USDT of INJ`,
      reason,
      payload: {
        proposal,
        policyId: state.policy?.id,
        nonce: state.policy?.next_nonce,
        source: p.proposal ? "manual" : "ai",
      },
    });
    return NextResponse.json({ id, proposal, checks, valid });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Proposal failed" },
      { status: 400 },
    );
  }
}
