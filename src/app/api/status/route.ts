import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    chain: "injective-888",
    codeId: process.env.NEXT_PUBLIC_VAULT_CODE_ID || null,
    agent: process.env.NEXT_PUBLIC_AGENT_ADDRESS || null,
    ai: !!process.env.OPENAI_API_KEY,
    database: !!process.env.DATABASE_URL,
    auth: !!process.env.SESSION_SECRET,
    execution: !!(
      process.env.AGENT_PRIVATE_KEY &&
      process.env.DATABASE_URL &&
      process.env.SESSION_SECRET &&
      process.env.NEXT_PUBLIC_VAULT_CODE_ID
    ),
    contractVerified: false,
  });
}
