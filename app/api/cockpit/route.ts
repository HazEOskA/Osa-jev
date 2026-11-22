import handler from "@/lib/cockpit-runtime.cjs";
import {requireUser} from "@/lib/server/account";
import {beginReply,finishReply,StoreError} from "@/lib/server/chat-store";
import {bodyJson,fail,guardMutation,json,uuid} from "@/lib/server/http";
export const runtime="nodejs";
export const maxDuration=90;
export const dynamic="force-dynamic";

async function run(body:unknown,method:string,url:string){
  let status=200, payload:unknown;
  const headers:Record<string,string>={};
  const res={
    setHeader(name:string,value:string){headers[name]=value;return this;},
    status(value:number){status=value;return this;},
    json(value:unknown){payload=value;return this;},
  };
  await handler({method,body,query:Object.fromEntries(new URL(url).searchParams)},res);
  return {status,payload,headers};
}
export async function GET(request:Request){
  try{
    await requireUser();
    const result=await run({},"GET",request.url);
    return json(result.payload,result.status);
  }catch(error){return fail(error);}
}
export async function POST(request:Request){
  const denied=guardMutation(request);if(denied)return denied;
  let started:{userId:string;conversationId:string;assistantId:string}|null=null;
  try{
    const user=await requireUser();
    const input=await bodyJson(request,1500);
    if(!uuid(input.conversationId)||!uuid(input.assistantMessageId))
      throw new StoreError(400,"Nieprawidłowy identyfikator odpowiedzi.");
    const conversationId=input.conversationId,assistantId=input.assistantMessageId;
    const context=await beginReply(user.id,conversationId,assistantId,"cockpit");
    started={userId:user.id,conversationId,assistantId};
    const last=context.history.at(-1);
    if(!last || last.role!=="user")throw new StoreError(409,"Nieprawidłowy stan rozmowy.");
    const result=await run({
      message:last.content,mode:input.mode==="agent"?"agent":"chat",
      provider:["nvidia","openrouter"].includes(context.modelId)?context.modelId:"auto",
      workspace:"OSA",
      memory:context.history.filter(m=>m.role==="user").slice(-7,-1).map(m=>m.content),
    },"POST",request.url);
    const data=result.payload as {answer?:string;receipt?:{generation_status?:string}};
    const success=result.status>=200 && result.status<300 &&
      typeof data?.answer==="string" && data?.receipt?.generation_status==="SUCCEEDED";
    await finishReply(user.id,conversationId,assistantId,success?"completed":"error",
      typeof data?.answer==="string"?data.answer:"",success?undefined:"runtime");
    started=null;
    return json(result.payload,result.status);
  }catch(error){
    if(started)await finishReply(started.userId,started.conversationId,started.assistantId,
      "error","","runtime").catch(()=>undefined);
    return fail(error);
  }
}
