"use strict";
const {test,after}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Module=require("node:module");
const ts=require("typescript");
const policy=require("../lib/osa-jeff/policy.cjs");
const srcPath=path.join(__dirname,"../app/api/glm-chat/route.ts");
const tempPath=path.join(__dirname,"../app/api/glm-chat/.test-runtime.cjs");
const output=ts.transpileModule(fs.readFileSync(srcPath,"utf8"),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},fileName:srcPath,
});

class StoreError extends Error {
  constructor(status,safeMessage){super(safeMessage);this.status=status;this.safeMessage=safeMessage;}
}
let authorized=true,failBegin=false,history=[],saved=[];
const refs={
  "@/lib/server/account":{requireUser:async()=>{if(!authorized)throw new StoreError(401,"Zaloguj się.");return {id:"google-sub-osa"};}},
  "@/lib/server/chat-store":{
    StoreError,
    beginReply:async(user,conversationId,assistantId,kind)=>{
      if(failBegin)throw new StoreError(404,"Nie znaleziono odpowiedzi.");
      assert.equal(user,"google-sub-osa");
      assert.equal(kind,"glm");
      assert.equal(conversationId,convId);
      assert.equal(assistantId,msgId);
      return {modelId:"glm",history};
    },
    finishReply:async(user,conversationId,assistantId,status,content,errorCode)=>{
      saved.push({user,conversationId,assistantId,status,content,errorCode});
    },
  },
  "@/lib/server/http":{
    guardMutation:req=>policy.trustedMutation(req)?null:Response.json({error:"CSRF"},{status:403}),
    bodyJson:async req=>JSON.parse(await req.text()),
    uuid:policy.validateUuid,
    json:(value,status=200)=>Response.json(value,{status}),
    fail:error=>Response.json({error:error instanceof StoreError?error.safeMessage:"Nie można wykonać."},
      {status:error instanceof StoreError?error.status:503}),
  },
};
const originalLoad=Module._load;
Module._load=function(name,parent,isMain){
  if(Object.hasOwn(refs,name))return refs[name];
  return originalLoad.call(this,name,parent,isMain);
};
let routes;
try{
  fs.writeFileSync(tempPath,output.outputText);
  routes=require(tempPath);
}finally{Module._load=originalLoad;}
const {POST,GET}=routes;
const original={fetch:global.fetch,apiKey:process.env.EXPLABS_API_KEY};
after(()=>{
  global.fetch=original.fetch;
  if(original.apiKey===undefined)delete process.env.EXPLABS_API_KEY;
  else process.env.EXPLABS_API_KEY=original.apiKey;
  try{fs.unlinkSync(tempPath);}catch{}
});
const convId="6dc1246d-160f-4a02-b1d4-381b70d06107";
const msgId="8076c145-28f9-46d1-8008-05e83efcafcc";
const url="https://osa-jeff.vercel.app/api/glm-chat";
const req=(body={conversationId:convId,assistantMessageId:msgId},origin=new URL(url).origin)=>
  new Request(url,{method:"POST",headers:{"Content-Type":"application/json",Origin:origin},body:JSON.stringify(body)});
function reset(){
  authorized=true;failBegin=false;saved=[];history=[{role:"user",content:"Hej, Jeff!"}];
  process.env.EXPLABS_API_KEY="fake-explabs-test";
}
test("unauthenticated user is denied; no upstream network",async()=>{
  reset();authorized=false;
  global.fetch=async()=>{throw Error("unexpected upstream fetch");};
  const response=await POST(req());assert.equal(response.status,401);
});
test("cross-origin POST denied before any model call",async()=>{
  reset();
  const response=await POST(req(undefined,"https://attacker.test"));
  assert.equal(response.status,403);assert.equal(saved.length,0);
});
test("missing or invalid conversation identifiers denied",async()=>{
  reset();
  const response=await POST(req({conversationId:"garbage",assistantMessageId:msgId}));
  assert.equal(response.status,400);assert.equal(saved.length,0);
});
test("missing provider key denied, no DB turn is started",async()=>{
  reset();delete process.env.EXPLABS_API_KEY;
  const response=await POST(req());assert.equal(response.status,503);assert.equal(saved.length,0);
});
test("database ownership check fails closed",async()=>{
  reset();failBegin=true;
  const response=await POST(req());assert.equal(response.status,404);assert.equal(saved.length,0);
});
test("server history, not client text, is forwarded and response persisted before DONE",async()=>{
  reset();
  history=[{role:"user",content:"Pierwsze pytanie."},{role:"assistant",content:"Odpowiedź."},{role:"user",content:"Hej, Jeff!"}];
  global.fetch=async(url,options)=>{
    assert.equal(url,"https://api.experientiallabs.ai/v1/chat/completions");
    assert.equal(options.headers.Authorization,"Bearer fake-explabs-test");
    const value=JSON.parse(options.body);
    assert.equal(value.model,"glm-5.3-flash-uncensored");
    assert.equal(value.stream,true);
    assert.equal(value.messages.at(-1).content,"Hej, Jeff!");
    return new Response('data: {"choices":[{"delta":{"content":"Cześć"}}]}\n\ndata: [DONE]\n\n',
      {headers:{"content-type":"text/event-stream"}});
  };
  const res=await POST(req({conversationId:convId,assistantMessageId:msgId,messages:[{role:"user",content:"FORGED"}]}));
  assert.equal(res.status,200);
  assert.match(await res.text(),/Cześć/);
  assert.deepEqual(saved.map(s=>({status:s.status,content:s.content})),[{status:"completed",content:"Cześć"}]);
  assert.equal((await GET()).status,200);
});
test("upstream 404 gives sanitized error, persists failed turn",async()=>{
  reset();
  global.fetch=async()=>new Response('{"error":"private API detail"}',{status:404});
  const res=await POST(req());
  assert.equal(res.status,502);
  const body=await res.json();
  assert.doesNotMatch(JSON.stringify(body),/private API detail/);
  assert.deepEqual(saved.map(s=>s.status),["error"]);
});
test("truncated SSE is never a success and persists error",async()=>{
  reset();
  global.fetch=async()=>new Response('data: {"choices":[{"delta":{"content":"Fragment"}}]}\n\n',
    {headers:{"content-type":"text/event-stream"}});
  const res=await POST(req());
  assert.equal(res.status,200);
  const body=await res.text();
  assert.match(body,/Fragment/);
  assert.doesNotMatch(body,/\[DONE\]/);
  assert.deepEqual(saved.map(s=>s.status),["error"]);
});
