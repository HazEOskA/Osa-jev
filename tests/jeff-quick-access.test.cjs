"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const {COOKIE,TTL_SECONDS,createSession,verifySession,sameOrigin}=require("../lib/jeff-session.cjs");
const token=crypto.randomBytes(32).toString("hex");
test("30-day session: signed, unpredictable, expiry and tamper protection",()=>{
  assert.equal(TTL_SECONDS,2592000);
  const a=createSession(token,10000000);
  const b=createSession(token,10000000);
  assert.notEqual(a,b);
  assert.equal(verifySession(a,token,10000000),true);
  assert.equal(verifySession(a,token,10000000+TTL_SECONDS*1000-1),true);
  assert.equal(verifySession(a,token,10000000+TTL_SECONDS*1000),false);
  assert.equal(verifySession(a,crypto.randomBytes(32).toString("hex"),10000000),false);
  assert.equal(verifySession(a.slice(0,-1)+(a.at(-1)==="A"?"B":"A"),token,10000000),false);
  assert.equal(verifySession("invalid",token),false);
  assert.equal(verifySession(a,undefined),false);
});
test("same origin rejects cross-site writes even with session cookie",()=>{
  const req=(origin,site)=>({url:"https://preview.example/api/jeff-session",headers:new Headers({
    ...(origin?{origin}:{}),...(site?{"sec-fetch-site":site}:{})
  })});
  assert.equal(sameOrigin(req("https://preview.example")),true);
  assert.equal(sameOrigin(req("https://attacker.example")),false);
  assert.equal(sameOrigin(req(undefined,"same-origin")),true);
  assert.equal(sameOrigin(req(undefined,"cross-site")),false);
  assert.equal(sameOrigin(req(undefined,undefined)),false);
});
test("cookie configuration is HttpOnly Secure Strict and host-only",()=>{
  const route=fs.readFileSync(path.join(__dirname,"../app/api/jeff-session/route.ts"),"utf8");
  assert.match(COOKIE,/^__Host-/);
  assert.match(route,/httpOnly:true,secure:true,sameSite:"strict",path:"\/",maxAge:session\.TTL_SECONDS/);
  assert.match(route,/session\.createSession\(expected\)/);
  assert.doesNotMatch(route,/localStorage|sessionStorage/);
});
test("GLM relies on cookie access and never submits token per message",()=>{
  const base=path.join(__dirname,"../components/agent-chat");
  const adapter=fs.readFileSync(path.join(base,"services/adapters/cockpit.ts"),"utf8");
  const hook=fs.readFileSync(path.join(base,"hooks/useChat.ts"),"utf8");
  const prefs=fs.readFileSync(path.join(base,"state/settings.ts"),"utf8");
  const db=fs.readFileSync(path.join(base,"services/history-store.ts"),"utf8");
  assert.match(adapter,/credentials:'same-origin'/);
  assert.doesNotMatch(adapter,/glmAccessToken|Authorization.*Bearer/);
  assert.doesNotMatch(hook+prefs,/glmAccessToken/);
  assert.match(prefs,/modelId:'glm'/);
  assert.match(db,/indexedDB\.open\(DATABASE,VERSION\)/);
  assert.doesNotMatch(db,/localStorage|token|secret/i);
});
test("IndexedDB persists chat across adapter instances and deletes explicitly",async()=>{
  const rows=new Map();
  const database={
    objectStoreNames:{contains:()=>true},createObjectStore(){},
    close(){},
    transaction(){
      const tx={oncomplete:null,onerror:null,onabort:null};
      tx.objectStore=()=>({
        getAll(){const req={onsuccess:null,onerror:null,result:null};queueMicrotask(()=>{req.result=[...rows.values()];req.onsuccess?.();tx.oncomplete?.();});return req;},
        put(row){queueMicrotask(()=>{rows.set(row.id,structuredClone(row));tx.oncomplete?.();});},
        delete(id){queueMicrotask(()=>{rows.delete(id);tx.oncomplete?.();});},
      });
      return tx;
    },
  };
  const original=global.indexedDB;
  global.indexedDB={open(){const req={result:database,onsuccess:null,onupgradeneeded:null,onerror:null,onblocked:null};queueMicrotask(()=>req.onsuccess?.());return req;}};
  try{
    const {CockpitAdapter}=await import("../components/agent-chat/services/adapters/cockpit.ts");
    const a=new CockpitAdapter();
    const created=await a.createConversation();
    assert.equal(rows.has(created.id),true);
    const b=new CockpitAdapter();
    assert.equal((await b.getConversations()).some(c=>c.id===created.id),true);
    await b.renameConversation(created.id,"Nowy tytuł");
    const c=new CockpitAdapter();
    assert.equal((await c.getConversation(created.id)).title,"Nowy tytuł");
    await c.deleteConversation(created.id);
    assert.equal((await new CockpitAdapter().getConversations()).length,0);
  }finally{if(original===undefined)delete global.indexedDB;else global.indexedDB=original;}
});
