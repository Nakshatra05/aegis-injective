import { z } from "zod";
import { MARKET, type Policy } from "./config";
import { positive, units } from "./amount";
export const proposalSchema = z
  .object({
    market: z.literal(MARKET),
    direction: z.literal("buy"),
    quoteAmount: z.string().max(45),
    limitPrice: z.string().max(45),
    explanation: z.string().min(1).max(500),
  })
  .strict()
  .superRefine((p, ctx) => {
    try {
      positive(p.quoteAmount);
      const price = units(p.limitPrice);
      if (price === 0n || price % 1000n !== 0n)
        throw new Error(
          "Limit price must be positive and in 0.001 USDT ticks.",
        );
    } catch (e) {
      ctx.addIssue({
        code: "custom",
        message: e instanceof Error ? e.message : "Invalid amount",
      });
    }
  });
export type Proposal = z.infer<typeof proposalSchema>;
export function preflight(
  p: Policy | null,
  proposal: Proposal,
  now: number,
  agent?: string,
): { label: string; ok: boolean }[] {
  const budget = units(proposal.quoteAmount),
    price = units(proposal.limitPrice);
  return [
    {
      label: "Active, unrevoked policy",
      ok: !!p && !p.revoked && now < p.expires_at,
    },
    { label: "Designated agent", ok: !!p && (!agent || p.agent === agent) },
    {
      label: "INJ/USDT · buy only",
      ok: proposal.market === MARKET && proposal.direction === "buy",
    },
    {
      label: "Per-order quote limit",
      ok: !!p && budget <= BigInt(p.per_order),
    },
    {
      label: "Remaining cumulative allowance",
      ok: !!p && budget + BigInt(p.spent) <= BigInt(p.cap),
    },
    {
      label: "Owner-approved price ceiling",
      ok: !!p && price <= BigInt(p.max_price),
    },
  ];
}
