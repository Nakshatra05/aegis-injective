import { NextResponse } from "next/server";
import { z } from "zod";
import { schema, db } from "@/lib/server/db";
import { sameOrigin, token, verifyOwnerSignature } from "@/lib/server/auth";
import { CHAIN_ID } from "@/lib/config";
export const runtime = "nodejs";
const input = z
  .object({
    owner: z.string().regex(/^inj1[a-z0-9]{38}$/),
    id: z.string().uuid().optional(),
    signature: z
      .object({
        pub_key: z.object({ type: z.string(), value: z.string().max(200) }),
        signature: z.string().max(200),
      })
      .optional(),
  })
  .strict();
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const p = input.parse(await request.json());
    await schema();
    if (!p.id || !p.signature) {
      const recent = await db()`SELECT count(*)::int AS count FROM aegis_challenges WHERE owner=${p.owner} AND expires_at>now()-interval '5 minutes'`;
      if(recent[0].count>=10)throw new Error('Too many sign-in challenges. Wait a few minutes.');
      const id = crypto.randomUUID();
      const message = `Aegis owner session\nOrigin: ${process.env.APP_ORIGIN}\nChain: ${CHAIN_ID}\nOwner: ${p.owner}\nNonce: ${id}\nExpires: ${new Date(Date.now() + 300_000).toISOString()}\nAuthorize user-triggered proposals and agent executions for your verified vaults for one hour. No asset transfer is signed by this message.`;
      await db()`INSERT INTO aegis_challenges(id,owner,message,expires_at) VALUES(${id},${p.owner},${message},now()+interval '5 minutes')`;
      return NextResponse.json({ id, message });
    }
    const rows =
      await db()`SELECT * FROM aegis_challenges WHERE id=${p.id} AND owner=${p.owner} AND NOT used AND expires_at>now()`;
    if (!rows[0]) throw new Error("Challenge expired or already used.");
    verifyOwnerSignature(p.owner, rows[0].message, p.signature);
    const consumed =
      await db()`UPDATE aegis_challenges SET used=true WHERE id=${p.id} AND NOT used RETURNING id`;
    if (!consumed.length) throw new Error("Challenge already used.");
    const response = NextResponse.json({ owner: p.owner });
    response.cookies.set("aegis_session", token(p.owner), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 3600,
    });
    return response;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Authentication failed" },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const r = NextResponse.json({ ok: true });
    r.cookies.delete("aegis_session");
    return r;
  } catch {
    return NextResponse.json(
      { error: "Origin not authorized" },
      { status: 403 },
    );
  }
}
