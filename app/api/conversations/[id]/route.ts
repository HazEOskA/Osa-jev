import { requireUser } from "@/lib/server/account";
import { deleteConversation, getConversation, renameConversation, StoreError } from "@/lib/server/chat-store";
import { bodyJson, fail, guardMutation, json, uuid } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{id:string}> };
export async function GET(_request: Request, {params}:Context) {
  try {
    const {id}=await params; if (!uuid(id)) throw new StoreError(400,"Nieprawidłowy identyfikator.");
    const user=await requireUser();
    return json({conversation:await getConversation(user.id,id)});
  } catch(error){return fail(error);}
}
export async function PATCH(request: Request, {params}:Context) {
  const denied=guardMutation(request); if(denied)return denied;
  try {
    const {id}=await params; if(!uuid(id))throw new StoreError(400,"Nieprawidłowy identyfikator.");
    const body=await bodyJson(request,1000);
    if (typeof body.title!=="string") throw new StoreError(400,"Podaj nazwę.");
    const user=await requireUser();
    return json({conversation:await renameConversation(user.id,id,body.title)});
  }catch(error){return fail(error);}
}
export async function DELETE(request:Request,{params}:Context){
  const denied=guardMutation(request); if(denied)return denied;
  try{
    const {id}=await params;if(!uuid(id))throw new StoreError(400,"Nieprawidłowy identyfikator.");
    const user=await requireUser();
    await deleteConversation(user.id,id);
    return json({ok:true});
  }catch(error){return fail(error);}
}
