import { proposalSchema, type Proposal } from "../proposal";
import { MARKET } from "../config";
export interface ProposalProvider {
  propose(request: string, price: string): Promise<Proposal>;
}
export class OpenAIProposalProvider implements ProposalProvider {
  async propose(request: string, price: string): Promise<Proposal> {
    if (!process.env.OPENAI_API_KEY)
      throw new Error("AI is not configured. Use manual structured proposals.");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `Return a proposal only. You cannot authorize or execute trades. Only INJ/USDT spot buys are supported. Reject other intentions by refusing. Market must be ${MARKET}. quoteAmount is decimal USDT budget including fees. Use the owner-entered limit price ${price} exactly. Do not invent prices or balances. explanation must describe the request briefly.`,
          },
          { role: "user", content: request },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "spot_buy_proposal",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                market: { type: "string", enum: [MARKET] },
                direction: { type: "string", enum: ["buy"] },
                quoteAmount: { type: "string" },
                limitPrice: { type: "string" },
                explanation: { type: "string" },
              },
              required: [
                "market",
                "direction",
                "quoteAmount",
                "limitPrice",
                "explanation",
              ],
            },
          },
        },
      }),
    });
    if (!response.ok)
      throw new Error(
        `AI provider unavailable (${response.status}). Use manual entry.`,
      );
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI declined or returned no proposal.");
    return proposalSchema.parse(JSON.parse(content));
  }
}
