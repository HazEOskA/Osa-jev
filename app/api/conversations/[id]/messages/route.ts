import {requireUser} from "@/lib/server/account";
import {appendTurn,StoreError} from "@/lib/server/chat-store";
import {bodyJson,fail,guardMutation,json,uuid} from "@/lib/server/http";
const policy=require("@/lib/osa-jeff/policy.cjs") as {validModel:(x:unknown)=>boolean};
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const denied=guardMutation(request);if(denied)return denied;
  try{
    const {id}=await params; if(!uuid(id)) throw new StoreError(400,"Nieprawidłowy identyfikator rozmowy.");
    const body=await bodyJson(request,25000);
    if(typeof body.content!=="string" || !uuid(body.clientRequestId) || !policy.validModel(body.modelId))
      throw new StoreError(400,"Nieprawidłowe parametry wiadomości.");
    const user=await requireUser();
    const result=await appendTurn(user.id,id,body.content,String(body.modelId),String(body.clientRequestId));
    return json({result},201);
  }catch(error){return fail(error);}
}
