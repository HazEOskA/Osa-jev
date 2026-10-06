import type {ChatAPI} from '../api';
import type {Conversation,Execution,ProofRecord,SendRequest,SendResult,StreamEvent,SystemStatus} from '../../types';
export class CockpitAdapter implements ChatAPI {
 private conversations=new Map<string,Conversation>();
 private executions=new Map<string,Execution>();
 private proofs=new Map<string,ProofRecord>();
 async getConversations(){return structuredClone([...this.conversations.values()]);}
 async getConversation(id:string){const c=this.conversations.get(id);if(!c)throw Error('Nie znaleziono rozmowy');return structuredClone(c);}
 async createConversation(){const now=new Date().toISOString();const c:Conversation={id:crypto.randomUUID(),title:'Nowa rozmowa',createdAt:now,updatedAt:now,messages:[]};this.conversations.set(c.id,c);return structuredClone(c);}
 async renameConversation(id:string,title:string){const c=this.conversations.get(id);if(!c)throw Error('Brak rozmowy');c.title=title.trim()||'Nowa rozmowa';}
 async deleteConversation(id:string){this.conversations.delete(id);}
 async sendMessage(r:SendRequest):Promise<SendResult>{
  if(r.attachments.length)throw Error('Przesyłanie załączników nie jest jeszcze dostępne.');
  const c=await this.getConversation(r.conversationId),now=new Date().toISOString(),id=crypto.randomUUID();
  const execution:Execution={id,conversationId:c.id,status:'running',createdAt:now,steps:[],components:{Hermes:'unknown',Jeverson:'pending',Runtime:'running',APR:'unknown',Monitoring:'unknown'}};
  this.executions.set(id,execution);
  return {user:{id:crypto.randomUUID(),conversationId:c.id,role:'user',content:r.content,createdAt:now,status:'completed'},assistant:{id:crypto.randomUUID(),conversationId:c.id,role:'assistant',content:'',createdAt:now,status:'streaming',executionId:id},execution};
 }
 async *streamMessage(result:SendResult,r:SendRequest,signal:AbortSignal):AsyncIterable<StreamEvent>{
  const c=this.conversations.get(r.conversationId);if(!c)throw Error('Brak rozmowy');c.messages.push(result.user,result.assistant);c.updatedAt=result.user.createdAt;if(c.messages.length===2)c.title=r.content.slice(0,46);
  const controller=new AbortController();const cancel=()=>controller.abort();signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();const timer=setTimeout(cancel,95000);
  try{
   const response=await fetch('/api/cockpit',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({message:r.content,mode:r.mode==='agent'?'agent':'chat',provider:['nvidia','openrouter'].includes(r.modelId)?r.modelId:'auto',workspace:'OSA',memory:c.messages.filter(m=>m.role==='user'&&m.id!==result.user.id).slice(-6).map(m=>m.content)})});
   const d=await response.json();if(!response.ok||typeof d.answer!=='string'||typeof d.receipt?.execution_id!=='string')throw Error('Nieprawidłowa odpowiedź runtime');
   const success=d.receipt.generation_status==='SUCCEEDED';const now=new Date().toISOString();
   const execution:Execution={...result.execution,id:d.receipt.execution_id,status:success?'completed':'failed',steps:[{id:'runtime',name:'Odpowiedź runtime · '+String(d.receipt.provider),status:success?'completed':'failed',timestamp:now,durationMs:Number(d.receipt.latency_ms)||0}],components:{Hermes:'unknown',Jeverson:d.route?.source==='jev'?'completed':'unknown',Runtime:success?'completed':'failed',APR:'unknown',Monitoring:'unknown'}};
   const proof:ProofRecord={id:'receipt_'+execution.id,executionId:execution.id,status:'recorded',timestamp:now,simulated:false,evidence:[{type:'execution_receipt',description:JSON.stringify(d.receipt,null,2),source:'/api/cockpit'}]};
   const message={...result.assistant,content:d.answer,status:success?'completed' as const:'error' as const,error:success?undefined:'runtime' as const,executionId:execution.id,proofId:proof.id};Object.assign(result.assistant,message);this.executions.set(execution.id,execution);this.proofs.set(proof.id,proof);
   yield {type:'complete',message,execution,proof};
  }catch{
   const code=signal.aborted?'interrupted':'network';const execution:Execution={...result.execution,status:signal.aborted?'cancelled':'failed'};Object.assign(result.assistant,{status:signal.aborted?'interrupted':'error',error:code});this.executions.set(execution.id,execution);yield {type:'error',code,execution};
  }finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);}
 }
 async getExecution(id:string){const e=this.executions.get(id);if(!e)throw Error('Brak wykonania');return e;}
 async getProof(id:string){const p=this.proofs.get(id);if(!p)throw Error('Brak receipt');return p;}
 async getSystemStatus():Promise<SystemStatus>{const r=await fetch('/api/cockpit');if(!r.ok)throw Error('Status niedostępny');const d=await r.json();return {status:d.runtime?.ready?'degraded':'offline',checkedAt:new Date().toISOString(),simulated:false,services:[{name:'Runtime · konfiguracja providera',status:d.runtime?.ready?'degraded':'offline'},{name:'Jeverson · konfiguracja klucza',status:d.runtime?.jev?'degraded':'offline'},{name:'Hermes',status:'unknown'},{name:'APR',status:'unknown'},{name:'Monitoring',status:'unknown'}]};}
}
