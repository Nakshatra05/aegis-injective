import postgres from "postgres";
let client: ReturnType<typeof postgres> | undefined;
export function db() {
  if (!process.env.DATABASE_URL)
    throw new Error("Durable PostgreSQL storage is not configured.");
  return (client ??= postgres(process.env.DATABASE_URL, {
    max: 3,
    idle_timeout: 10,
    connect_timeout: 10,
    prepare: false,
  }));
}
export async function schema() {
  const sql = db();
  await sql`CREATE TABLE IF NOT EXISTS aegis_challenges(id text PRIMARY KEY, owner text NOT NULL, message text NOT NULL, expires_at timestamptz NOT NULL, used boolean NOT NULL DEFAULT false)`;
  await sql`CREATE TABLE IF NOT EXISTS aegis_activity(id text PRIMARY KEY, owner text NOT NULL, vault text NOT NULL, kind text NOT NULL, summary text NOT NULL, reason text, tx_hash text, payload jsonb, created_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS aegis_execution(vault text NOT NULL, policy_id bigint NOT NULL, nonce bigint NOT NULL, proposal_id text NOT NULL UNIQUE, tx_hash text, tx_bytes text, status text NOT NULL, PRIMARY KEY(vault,policy_id,nonce))`;
}
export async function record(data: {
  owner: string;
  vault: string;
  kind: string;
  summary: string;
  reason?: string;
  tx_hash?: string;
  payload?: object;
}) {
  await schema();
  const id = crypto.randomUUID();
  await db()`INSERT INTO aegis_activity(id,owner,vault,kind,summary,reason,tx_hash,payload) VALUES(${id},${data.owner},${data.vault},${data.kind},${data.summary},${data.reason ?? null},${data.tx_hash ?? null},${JSON.stringify(data.payload ?? {})}::jsonb)`;
  return id;
}
