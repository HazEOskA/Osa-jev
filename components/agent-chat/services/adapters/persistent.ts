import type {ChatAPI} from "../api";
import type {Conversation,Execution,ProofRecord,SendRequest,SendResult,StreamEvent,SystemStatus} from "../../types";
const {readGlmSse}:{readGlmSse:(body:ReadableStream<Uint8Array>,signal:AbortSignal)=>AsyncIterable<string>}=
  require("../glm-sse.cjs");

async function requestJson<T>(url:string,options:RequestInit={}):Promise<T>{
  const res=await fetch(url,{...options,credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data:unknown=await res.json().catch(()=>({}));
  if(!res.ok){
    const obj=data as {error?:string};
    throw Error(typeof obj?.error==="string"?obj.error:"Serwer niedostępny (HTTP "+res.status+").");
  }
  return data as T;
}
export class PersistentCockpitAdapter implements ChatAPI {
  private executions=new Map<string,Execution>();
  private proofs=new Map<string,ProofRecord>();

  async getConversations(){
    const data=await requestJson<{conversations:Conversation[]}>("/api/conversations");
    return data.conversations;
  }
  async getConversation(id:string){
    const data=await requestJson<{conversation:Conversation}>("/api/conversations/"+encodeURIComponent(id));
    return data.conversation;
  }
  async createConversation(){
    const data=await requestJson<{conversation:Conversation}>("/api/conversations",{
      method:"POST",body:"{}",
    });
    return data.conversation;
  }
  async renameConversation(id:string,title:string){
    await requestJson("/api/conversations/"+encodeURIComponent(id),{
      method:"PATCH",body:JSON.stringify({title}),
    });
  }
  async deleteConversation(id:string){
    await requestJson("/api/conversations/"+encodeURIComponent(id),{method:"DELETE"});
  }
  async sendMessage(req:SendRequest):Promise<SendResult>{
    if(req.attachments.length)throw Error("Załączniki nie są jeszcze obsługiwane.");
    const data=await requestJson<{result:SendResult}>(
      "/api/conversations/"+encodeURIComponent(req.conversationId)+"/messages",{
      method:"POST",body:JSON.stringify({
        content:req.content,modelId:req.modelId,clientRequestId:crypto.randomUUID(),
      }),
    });
    this.executions.set(data.result.execution.id,data.result.execution);
    return data.result;
  }
  async *streamMessage(result:SendResult,req:SendRequest,signal:AbortSignal):AsyncIterable<StreamEvent>{
    const id=result.assistant.id,conversationId=result.assistant.conversationId;
    const started=new Date(result.execution.createdAt).getTime();
    const controller=new AbortController();
    const cancel=()=>controller.abort();
    signal.addEventListener("abort",cancel,{once:true});
    if(signal.aborted)cancel();
    const timer=setTimeout(cancel,95000);
    try{
      if(req.modelId==="glm"){
        const response=await fetch("/api/glm-chat",{
          method:"POST",credentials:"same-origin",cache:"no-store",
          headers:{"Content-Type":"application/json"},
          signal:controller.signal,
          body:JSON.stringify({conversationId,assistantMessageId:id}),
        });
        if(!response.ok||!response.body){
          const body=await response.json().catch(()=>({})) as {error?:string};
          throw Error(body.error||"GLM HTTP "+response.status);
        }
        let answer="";
        for await(const delta of readGlmSse(response.body,controller.signal)){
          answer+=delta;result.assistant.content=answer;
          yield {type:"delta",text:delta};
        }
        if(!answer.trim())throw Error("Brak odpowiedzi GLM.");
        const now=new Date().toISOString();
        const execution:Execution={...result.execution,status:"completed",
          steps:[{id:"glm",name:"GLM · zakończony strumień SSE",status:"completed",timestamp:now,
            durationMs:Date.now()-started}],
          components:{Hermes:"unknown",Jeverson:"unknown",Runtime:"completed",APR:"unknown",Monitoring:"unknown"}};
        const message={...result.assistant,content:answer,status:"completed" as const};
        this.executions.set(execution.id,execution);
        yield {type:"complete",message,execution};
        return;
      }
      const data=await requestJson<{
        answer:string;receipt:{execution_id:string;generation_status:string;latency_ms:number;provider:string};
        route?:{source?:string};
      }>("/api/cockpit",{
        method:"POST",signal:controller.signal,
        body:JSON.stringify({conversationId,assistantMessageId:id,mode:req.mode}),
      });
      const success=data.receipt?.generation_status==="SUCCEEDED";
      const now=new Date().toISOString();
      const execution:Execution={
        ...result.execution,id:data.receipt?.execution_id||id,
        status:success?"completed":"failed",
        steps:[{id:"runtime",name:"Odpowiedź runtime · "+String(data.receipt?.provider||"unknown"),
          status:success?"completed":"failed",timestamp:now,durationMs:Number(data.receipt?.latency_ms)||0}],
        components:{Hermes:"unknown",Jeverson:data.route?.source==="jev"?"completed":"unknown",
          Runtime:success?"completed":"failed",APR:"unknown",Monitoring:"unknown"},
      };
      const proof:ProofRecord={
        id:"receipt_"+execution.id,executionId:execution.id,status:"recorded",timestamp:now,
        simulated:false,evidence:[{type:"execution_receipt",description:JSON.stringify(data.receipt,null,2),source:"/api/cockpit"}],
      };
      const message={...result.assistant,content:data.answer||"",
        status:success?"completed" as const:"error" as const,
        error:success?undefined:"runtime" as const,executionId:execution.id,proofId:proof.id};
      this.executions.set(execution.id,execution);
      this.proofs.set(proof.id,proof);
      yield {type:"complete",message,execution,proof};
    }catch{
      const interrupted=signal.aborted||controller.signal.aborted;
      const execution:Execution={...result.execution,status:interrupted?"cancelled":"failed"};
      this.executions.set(execution.id,execution);
      yield {type:"error",code:interrupted?"interrupted":"runtime",execution};
    }finally{
      clearTimeout(timer);signal.removeEventListener("abort",cancel);
    }
  }
  async getExecution(id:string){
    const record=this.executions.get(id);
    if(!record)throw Error("Brak bieżącego wykonania.");
    return record;
  }
  async getProof(id:string){
    const record=this.proofs.get(id);
    if(!record)throw Error("Brak bieżącego receipt.");
    return record;
  }
  async getSystemStatus():Promise<SystemStatus>{
    const response=await fetch("/api/cockpit",{credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw Error("Status niedostępny.");
    const data=await response.json();
    return {status:data.runtime?.ready?"degraded":"offline",checkedAt:new Date().toISOString(),
      simulated:false,services:[
        {name:"Runtime · konfiguracja providera",status:data.runtime?.ready?"degraded":"offline"},
        {name:"Jeverson · konfiguracja klucza",status:data.runtime?.jev?"degraded":"offline"},
        {name:"Hermes",status:"unknown"},{name:"APR",status:"unknown"},{name:"Monitoring",status:"unknown"},
      ]};
  }
}
