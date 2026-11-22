"use strict";
const {test,after}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const crypto=require("node:crypto");
const source=path.join(__dirname,"../components/agent-chat/services/adapters/persistent.ts");
const compiled=path.join(__dirname,"../components/agent-chat/services/adapters/.test-persistent.cjs");
const output=ts.transpileModule(fs.readFileSync(source,"utf8"),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},fileName:source,
});
fs.writeFileSync(compiled,output.outputText);
const {PersistentCockpitAdapter}=require(compiled);
const original=global.fetch;
after(()=>{global.fetch=original;try{fs.unlinkSync(compiled)}catch{}});
const user="google-sub-osa";
const convId=crypto.randomUUID();
const req=(id,modelId="glm")=>({
  conversationId:id,content:"Sprawdź integrację",modelId,mode:"agent",attachments:[],scenario:"success",
});
const response=(payload,status=200)=>new Response(JSON.stringify(payload),{
  status,headers:{"Content-Type":"application/json"},
});
function backend(){
  const records=new Map();
  let calls=[];
  global.fetch=async(url,opts={})=>{
    const address=String(url);
    calls.push({url:address,method:opts.method||"GET",headers:opts.headers});
    if(address==="/api/conversations" && opts.method==="POST"){
      const c={id:crypto.randomUUID(),title:"Nowa rozmowa",createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString(),messages:[]};
      records.set(c.id,c);return response({conversation:c},201);
    }
    if(address==="/api/conversations" && !opts.method){
      return response({conversations:[...records.values()]});
    }
    const one=address.match(/^\/api\/conversations\/([0-9a-f-]+)$/);
    if(one){
      const c=records.get(one[1]);if(!c)return response({error:"Brak rozmowy"},404);
      if(opts.method==="PATCH"){c.title=JSON.parse(opts.body).title;return response({conversation:c});}
      if(opts.method==="DELETE"){records.delete(one[1]);return response({ok:true});}
      return response({conversation:c});
    }
    const messages=address.match(/^\/api\/conversations\/([0-9a-f-]+)\/messages$/);
    if(messages){
      const c=records.get(messages[1]);const input=JSON.parse(opts.body);
      const now=new Date().toISOString();
      const usr={id:crypto.randomUUID(),conversationId:c.id,content:input.content,
        role:"user",status:"completed",createdAt:now};
      const assistant={id:crypto.randomUUID(),conversationId:c.id,content:"",
        role:"assistant",status:"streaming",createdAt:now};
      c.messages.push(usr,assistant);
      const execution={id:assistant.id,conversationId:c.id,status:"running",createdAt:now,
        steps:[],components:{Hermes:"unknown",Jeverson:"pending",Runtime:"running",APR:"unknown",Monitoring:"unknown"}};
      return response({result:{user:usr,assistant,execution}},201);
    }
    if(address==="/api/glm-chat"){
      assert.equal(opts.credentials,"same-origin");
      assert.equal(opts.headers.Authorization,undefined);
      const input=JSON.parse(opts.body);
      const c=records.get(input.conversationId);
      assert.ok(c.messages.some(m=>m.id===input.assistantMessageId));
      return new Response('data: {"choices":[{"delta":{"content":"Odpowiedź GLM"}}]}\n\ndata: [DONE]\n\n',
        {headers:{"Content-Type":"text/event-stream"}});
    }
    if(address==="/api/cockpit"){
      return response({answer:"Runtime offline",receipt:{generation_status:"NOT_CONFIGURED"}},503);
    }
    throw Error("Nieznany mock endpoint: "+address);
  };
  return {records,calls};
}
test("persistent adapter: API create/list/rename/delete without local Map of chats",async()=>{
  const {records}=backend();const api=new PersistentCockpitAdapter();
  const c=await api.createConversation();
  assert.equal((await api.getConversations()).length,1);
  await api.renameConversation(c.id,"Projekt OSA");
  assert.equal((await api.getConversation(c.id)).title,"Projekt OSA");
  await api.deleteConversation(c.id);
  assert.equal(records.size,0);
});
test("persistent adapter: GLM uses signed session, no browser secret, SSE completes",async()=>{
  const {records,calls}=backend();const api=new PersistentCockpitAdapter();
  const c=await api.createConversation();const request=req(c.id);
  const initial=await api.sendMessage(request);
  const events=[];
  for await(const event of api.streamMessage(initial,request,new AbortController().signal))events.push(event);
  assert.equal(events[0].type,"delta");assert.equal(events.at(-1).type,"complete");
  assert.equal(events.at(-1).message.content,"Odpowiedź GLM");
  assert.equal(events.at(-1).execution.components.APR,"unknown");
  assert.equal(calls.filter(x=>x.url==="/api/glm-chat").length,1);
  assert.equal(records.get(c.id).messages.length,2);
});
test("persistent adapter: unavailable provider is a failure, not success",async()=>{
  backend();const api=new PersistentCockpitAdapter();
  const c=await api.createConversation();
  const request=req(c.id,"openrouter");
  const initial=await api.sendMessage(request);
  const events=[];
  for await(const event of api.streamMessage(initial,request,new AbortController().signal))events.push(event);
  assert.equal(events.length,1);
  assert.equal(events[0].type,"error");
  assert.equal(events[0].execution.status,"failed");
});
