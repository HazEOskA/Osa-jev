import type {NextRequest} from "next/server";
import {requireUser} from "@/lib/server/account";
import {beginReply,finishReply,StoreError} from "@/lib/server/chat-store";
import {bodyJson,fail,guardMutation,json,uuid} from "@/lib/server/http";
const core = require("../../../lib/glm-chat-core.cjs") as {
  MODEL:string; makeCompletion:(input:unknown)=>unknown;
};
const {readGlmSse} = require("../../../components/agent-chat/services/glm-sse.cjs") as {
  readGlmSse:(body:ReadableStream<Uint8Array>,signal:AbortSignal)=>AsyncIterable<string>;
};
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=90;

export async function GET() {
  try {
    await requireUser();
    return json({ok:true,configured:Boolean(process.env.EXPLABS_API_KEY),model:process.env.EXPLABS_MODEL||core.MODEL});
  } catch(error) {return fail(error);}
}
export async function POST(request:NextRequest) {
  const denied=guardMutation(request);if(denied)return denied;
  let started: {userId:string;conversationId:string;assistantId:string}|null=null;
  try {
    const user=await requireUser();
    const input=await bodyJson(request,1200);
    if (!uuid(input.conversationId)||!uuid(input.assistantMessageId))
      throw new StoreError(400,"Nieprawidłowy identyfikator odpowiedzi.");
    const key=process.env.EXPLABS_API_KEY;
    if (!key) throw new StoreError(503,"Dostawca GLM nie jest skonfigurowany.");
    const conversationId=input.conversationId,assistantId=input.assistantMessageId;
    const context=await beginReply(user.id,conversationId,assistantId,"glm");
    started={userId:user.id,conversationId,assistantId};
    const completion=core.makeCompletion({messages:context.history});
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(80_000)]);
    const upstream=await fetch("https://api.experientiallabs.ai/v1/chat/completions",{
      method:"POST",
      headers:{Authorization:"Bearer "+key,"Content-Type":"application/json",Accept:"text/event-stream"},
      body:JSON.stringify(completion),
      signal,
      cache:"no-store",
    });
    if(!upstream.ok) {
      await upstream.body?.cancel().catch(()=>undefined);
      const messages:Record<number,string>={
        400:"Dostawca odrzucił parametry zapytania.",
        401:"Dostawca odrzucił klucz API.",
        402:"Brak środków lub wymagana płatność u dostawcy.",
        403:"Dostawca odrzucił dostęp do modelu.",
        404:"Model GLM jest niedostępny.",
        429:"Osiągnięto limit dostawcy.",
      };
      throw new StoreError(upstream.status===429?429:502,messages[upstream.status]||"Dostawca GLM jest niedostępny.");
    }
    if(!upstream.body || !upstream.headers.get("content-type")?.includes("text/event-stream")) {
      await upstream.body?.cancel().catch(()=>undefined);
      throw new StoreError(502,"Dostawca nie zwrócił strumienia SSE.");
    }
    const encoder=new TextEncoder();
    const cancel=new AbortController();
    const streamedSignal=AbortSignal.any([signal,cancel.signal]);
    const stream=new ReadableStream<Uint8Array>({
      async start(controller){
        let answer="";
        try{
          for await(const text of readGlmSse(upstream.body!,streamedSignal)){
            answer+=text;
            if(answer.length>200000)throw Error("GLM_RESPONSE_TOO_LONG");
            controller.enqueue(encoder.encode("data: "+JSON.stringify({choices:[{delta:{content:text}}]})+"\n\n"));
          }
          if(!answer.trim())throw Error("GLM_EMPTY_RESPONSE");
          await finishReply(user.id,conversationId,assistantId,"completed",answer);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        }catch(error){
          const interrupted=streamedSignal.aborted;
          await finishReply(user.id,conversationId,assistantId,interrupted?"interrupted":"error",answer,
            interrupted?"interrupted":"runtime").catch(()=>undefined);
          if(!cancel.signal.aborted){
            try{controller.enqueue(encoder.encode("data: "+JSON.stringify({error:{message:"Nie udało się zakończyć odpowiedzi GLM."}})+"\n\n"));}
            catch{ /* client disconnected */ }
          }
        }finally{
          try{controller.close();}catch{ /* client disconnected */ }
        }
      },
      cancel(){cancel.abort();}
    });
    started=null; // The stream itself now owns the final database write.
    return new Response(stream,{status:200,headers:{
      "Content-Type":"text/event-stream; charset=utf-8",
      "Cache-Control":"no-cache, no-transform",
      "X-Content-Type-Options":"nosniff",
    }});
  }catch(error){
    if(started)await finishReply(started.userId,started.conversationId,started.assistantId,
      "error","","runtime").catch(()=>undefined);
    return fail(error);
  }
}
