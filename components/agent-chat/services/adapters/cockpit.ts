import type {ChatAPI} from '../api';
import {loadHistory,storeConversation,removeConversation} from '../history-store.ts';
import type {Conversation,Execution,ProofRecord,SendRequest,SendResult,StreamEvent,SystemStatus} from '../../types';
import sse from '../glm-sse.cjs';
const {readGlmSse}:{readGlmSse:(body:ReadableStream<Uint8Array>,signal:AbortSignal)=>AsyncIterable<string>}=sse;
export class CockpitAdapter implements ChatAPI {
 private conversations=new Map<string,Conversation>();
 private executions=new Map<string,Execution>();
 private proofs=new Map<string,ProofRecord>();
 private hydrated=false;
 private async hydrate(){
  if(this.hydrated)return;
  const saved=await loadHistory();
  for(const conversation of saved)this.conversations.set(conversation.id,conversation);
  this.hydrated=true;
 }
 async getConversations(){await this.hydrate();return structuredClone([...this.conversations.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));}
 async getConversation(id:string){await this.hydrate();const c=this.conversations.get(id);if(!c)throw Error('Nie znaleziono rozmowy');return structuredClone(c);}
 async createConversation(){await this.hydrate();const now=new Date().toISOString();const c:Conversation={id:crypto.randomUUID(),title:'Nowa rozmowa',createdAt:now,updatedAt:now,messages:[]};this.conversations.set(c.id,c);await storeConversation(c);return structuredClone(c);}
 async renameConversation(id:string,title:string){await this.hydrate();const c=this.conversations.get(id);if(!c)throw Error('Brak rozmowy');c.title=title.trim()||'Nowa rozmowa';c.updatedAt=new Date().toISOString();await storeConversation(c);}
 async deleteConversation(id:string){await this.hydrate();await removeConversation(id);this.conversations.delete(id);}
 async sendMessage(r:SendRequest):Promise<SendResult>{
  if(r.attachments.length)throw Error('Przesyłanie załączników nie jest jeszcze dostępne.');
  const c=await this.getConversation(r.conversationId),now=new Date().toISOString(),id=crypto.randomUUID();
  const execution:Execution={id,conversationId:c.id,status:'running',createdAt:now,steps:[],components:{Hermes:'unknown',Jeverson:'pending',Runtime:'running',APR:'unknown',Monitoring:'unknown'}};
  this.executions.set(id,execution);
  return {user:{id:crypto.randomUUID(),conversationId:c.id,role:'user',content:r.content,createdAt:now,status:'completed'},assistant:{id:crypto.randomUUID(),conversationId:c.id,role:'assistant',content:'',createdAt:now,status:'streaming',executionId:id},execution};
 }
 async *streamMessage(result:SendResult,r:SendRequest,signal:AbortSignal):AsyncIterable<StreamEvent>{
  const c=this.conversations.get(r.conversationId);if(!c)throw Error('Brak rozmowy');c.messages.push(result.user,result.assistant);c.updatedAt=result.user.createdAt;if(c.messages.length===2)c.title=r.content.slice(0,46);await storeConversation(c);
  const controller=new AbortController();const cancel=()=>controller.abort();signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();const timer=setTimeout(cancel,95000);
  try{
   if(r.modelId==='glm'){
    const history=[{role:'user',content:r.content}];
    const response=await fetch('/api/glm-chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({messages:history})});
    if(!response.ok){const data=await response.json().catch(()=>null);throw Error(typeof data?.error==='string'?data.error:'GLM HTTP '+response.status);}if(!response.body)throw Error('GLM: brak odpowiedzi.');
    let answer='';
    for await(const delta of readGlmSse(response.body,controller.signal)){
     answer+=delta;result.assistant.content=answer;yield {type:'delta',text:delta};
    }
    if(!answer.trim())throw Error('GLM_EMPTY_RESPONSE');
    const now=new Date().toISOString();
    const execution:Execution={...result.execution,status:'completed',steps:[{id:'glm',name:'GLM · kompletny strumień SSE',status:'completed',timestamp:now,durationMs:Date.now()-new Date(result.execution.createdAt).getTime()}],components:{Hermes:'unknown',Jeverson:'unknown',Runtime:'completed',APR:'unknown',Monitoring:'unknown'}};
    const message={...result.assistant,content:answer,status:'completed' as const};Object.assign(result.assistant,message);this.executions.set(execution.id,execution);await storeConversation(c);
    yield {type:'complete',message,execution};
    return;
   }
   const response=await fetch('/api/cockpit',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({message:r.content,mode:r.mode==='agent'?'agent':'chat',provider:['nvidia','openrouter'].includes(r.modelId)?r.modelId:'auto',workspace:'OSA',memory:c.messages.filter(m=>m.role==='user'&&m.id!==result.user.id).slice(-6).map(m=>m.content)})});
   const d=await response.json();if((!response.ok&&response.status!==503)||typeof d.answer!=='string'||typeof d.receipt?.execution_id!=='string')throw Error('Nieprawidłowa odpowiedź runtime');
   const success=d.receipt.generation_status==='SUCCEEDED';const now=new Date().toISOString();
   const execution:Execution={...result.execution,id:d.receipt.execution_id,status:success?'completed':'failed',steps:[{id:'runtime',name:'Odpowiedź runtime · '+String(d.receipt.provider),status:success?'completed':'failed',timestamp:now,durationMs:Number(d.receipt.latency_ms)||0}],components:{Hermes:'unknown',Jeverson:d.route?.source==='jev'?'completed':'unknown',Runtime:success?'completed':'failed',APR:'unknown',Monitoring:'unknown'}};
   const proof:ProofRecord={id:'receipt_'+execution.id,executionId:execution.id,status:'recorded',timestamp:now,simulated:false,evidence:[{type:'execution_receipt',description:JSON.stringify(d.receipt,null,2),source:'/api/cockpit'}]};
   const message={...result.assistant,content:d.answer,status:success?'completed' as const:'error' as const,error:success?undefined:'runtime' as const,executionId:execution.id,proofId:proof.id};Object.assign(result.assistant,message);this.executions.set(execution.id,execution);this.proofs.set(proof.id,proof);await storeConversation(c);
   yield {type:'complete',message,execution,proof};
  }catch(err){
   const code=signal.aborted?'interrupted':r.modelId==='glm'?'runtime':'network';const execution:Execution={...result.execution,status:signal.aborted?'cancelled':'failed'};Object.assign(result.assistant,{status:signal.aborted?'interrupted':'error',error:code,errorDetail:r.modelId==='glm'&&!signal.aborted&&err instanceof Error?err.message:undefined});this.executions.set(execution.id,execution);await storeConversation(c);yield {type:'error',code,execution,detail:result.assistant.errorDetail};
  }finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);}
 }
 async getExecution(id:string){const e=this.executions.get(id);if(!e)throw Error('Brak wykonania');return e;}
 async getProof(id:string){const p=this.proofs.get(id);if(!p)throw Error('Brak receipt');return p;}
 async getSystemStatus():Promise<SystemStatus>{const r=await fetch('/api/cockpit');if(!r.ok)throw Error('Status niedostępny');const d=await r.json();return {status:d.runtime?.ready?'degraded':'offline',checkedAt:new Date().toISOString(),simulated:false,services:[{name:'Runtime · konfiguracja providera',status:d.runtime?.ready?'degraded':'offline'},{name:'Jeverson · konfiguracja klucza',status:d.runtime?.jev?'degraded':'offline'},{name:'Hermes',status:'unknown'},{name:'APR',status:'unknown'},{name:'Monitoring',status:'unknown'}]};}
}
