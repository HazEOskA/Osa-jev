import {requireUser} from "@/lib/server/account";
import {scoped} from "@/lib/server/db";
import {bodyJson,fail,guardMutation,json} from "@/lib/server/http";
import {StoreError} from "@/lib/server/chat-store";
const vault = require("@/lib/osa-jeff/vault.cjs") as {
  encrypt: (plain:string,userId:string,provider:string)=>string;
};
const providers=new Set(["openai","anthropic","google","openrouter","nvidia","custom"]);
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  try{
    const user=await requireUser();
    const list=await scoped(user.id,async db=>db.query(
      "SELECT provider,updated_at FROM user_credentials WHERE user_id=$1 ORDER BY provider",[user.id]));
    return json({credentials:list.rows.map(r=>({provider:r.provider,updatedAt:r.updated_at}))});
  }catch(error){return fail(error);}
}
export async function PUT(request:Request){
  const denied=guardMutation(request);if(denied)return denied;
  try{
    const body=await bodyJson(request,12000);
    if(typeof body.provider!=="string" || !providers.has(body.provider) || typeof body.value!=="string")
      throw new StoreError(400,"Nieprawidłowy dostawca lub klucz.");
    const user=await requireUser();
    const envelope=vault.encrypt(body.value.trim(),user.id,body.provider);
    await scoped(user.id,async db=>db.query(
      "INSERT INTO user_credentials(user_id,provider,envelope) VALUES($1,$2,$3) " +
      "ON CONFLICT(user_id,provider) DO UPDATE SET envelope=EXCLUDED.envelope,updated_at=now()",
      [user.id,body.provider,envelope]));
    return json({ok:true,provider:body.provider});
  }catch(error){return fail(error);}
}
export async function DELETE(request:Request){
  const denied=guardMutation(request);if(denied)return denied;
  try{
    const body=await bodyJson(request,1000);
    if(typeof body.provider!=="string" || !providers.has(body.provider))
      throw new StoreError(400,"Nieprawidłowy dostawca.");
    const user=await requireUser();
    await scoped(user.id,async db=>db.query(
      "DELETE FROM user_credentials WHERE user_id=$1 AND provider=$2",[user.id,body.provider]));
    return json({ok:true});
  }catch(error){return fail(error);}
}
