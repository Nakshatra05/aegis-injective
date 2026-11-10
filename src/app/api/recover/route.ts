import {NextResponse} from 'next/server';
import {z} from 'zod';
import {CosmosTxV1Beta1TxPb} from '@injectivelabs/sdk-ts/proto/cosmos-tx';
import {sameOrigin,session,ownedVault} from '@/lib/server/auth';
import {schema,db} from '@/lib/server/db';
import {receipt,chainClock} from '@/lib/chain';
import {broadcastBytes} from '@/lib/transactions';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
 try{
  sameOrigin(request);const owner=await session();const {hash}=z.object({hash:z.string().regex(/^[A-Fa-f0-9]{64}$/)}).strict().parse(await request.json());await schema();
  const rows=await db()`SELECT e.*,a.owner FROM aegis_execution e JOIN aegis_activity a ON a.id=e.proposal_id WHERE e.tx_hash=${hash} AND a.owner=${owner}`;
  const row=rows[0];if(!row||!row.tx_bytes)throw new Error('No recoverable execution owned by this session.');await ownedVault(row.vault,owner);
  const found=await receipt(hash);if(found)return NextResponse.json({message:'Transaction is included. Refresh activity to reconcile its outcome.'});
  const raw=CosmosTxV1Beta1TxPb.TxRaw.fromBinary(Buffer.from(row.tx_bytes,'base64'));const body=CosmosTxV1Beta1TxPb.TxBody.fromBinary(raw.bodyBytes);const clock=await chainClock();
  if(BigInt(clock.height)>body.timeoutHeight+3n){await db()`UPDATE aegis_activity SET kind='broadcast_unknown',reason='Transaction timeout height passed without an available receipt. No fill is claimed; check explorer. A new proposal may use the current onchain nonce.' WHERE tx_hash=${hash}`;await db()`DELETE FROM aegis_execution WHERE tx_hash=${hash}`;return NextResponse.json({message:'Transaction timeout passed. Reservation released; no execution is claimed. Inspect chain state before proposing again.'});}
  // Re-broadcast identical, already signed bytes only. Contract nonce and chain
  // sequence make this idempotent; caller cannot replace recipient or amount.
  const result=await broadcastBytes(row.tx_bytes);
  if(result.code!==0)return NextResponse.json({message:'Node did not accept rebroadcast. It may already be in the mempool. Keep checking the saved hash.'});
  await db()`UPDATE aegis_execution SET status='submitted' WHERE tx_hash=${hash}`;
  return NextResponse.json({message:'Identical signed transaction re-submitted. Refresh activity for its receipt.'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Recovery failed'},{status:400});}
}
