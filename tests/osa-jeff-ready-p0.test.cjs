"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const policy=require("../lib/osa-jeff/policy.cjs");
const vault=require("../lib/osa-jeff/vault.cjs");

const cfg={
  OSA_JEFF_ALLOWED_EMAILS:"osa@example.com,arek@example.com",
  AUTH_SECRET:"X".repeat(64), AUTH_GOOGLE_ID:"test-id",AUTH_GOOGLE_SECRET:"test-secret",
  DATABASE_URL:"postgresql://localhost/test",
};
test("exactly two distinct verified Google emails are allowlisted",()=>{
  assert.equal(policy.allowedEmails(cfg).size,2);
  assert.equal(policy.isAllowedGoogleProfile({sub:"1234567890",email:"OSA@example.com",email_verified:true},cfg),true);
  assert.equal(policy.isAllowedGoogleProfile({sub:"1234567890",email:"intruder@example.com",email_verified:true},cfg),false);
  assert.equal(policy.isAllowedGoogleProfile({sub:"1234567890",email:"osa@example.com",email_verified:false},cfg),false);
  assert.equal(policy.isAllowedGoogleProfile({sub:"wrong-sub",email:"osa@example.com",email_verified:true},cfg),false);
  assert.equal(policy.isAllowedGoogleProfile({sub:"1234567890",email:"osa@example.com"},cfg),false);
});
test("login infrastructure fails closed if OAuth, DB, or allowlist missing",()=>{
  assert.equal(policy.isConfigured(cfg),true);
  assert.equal(policy.isConfigured({...cfg,DATABASE_URL:""}),false);
  assert.equal(policy.isConfigured({...cfg,AUTH_SECRET:"bad"}),false);
  assert.equal(policy.isConfigured({...cfg,AUTH_GOOGLE_ID:""}),false);
  assert.equal(policy.isConfigured({...cfg,OSA_JEFF_ALLOWED_EMAILS:"osa@example.com"}),false);
  assert.equal(policy.isConfigured({...cfg,OSA_JEFF_ALLOWED_EMAILS:"osa@example.com,osa@example.com"}),false);
});
test("mutating endpoints reject cross-origin requests and missing browser origin",()=>{
  const req=(origin,site)=>({url:"https://osa-jeff.vercel.app/api/credentials",
    headers:new Headers({...origin?{Origin:origin}:{},...site?{"Sec-Fetch-Site":site}:{}})});
  assert.equal(policy.trustedMutation(req("https://osa-jeff.vercel.app")),true);
  assert.equal(policy.trustedMutation(req("https://attacker.example")),false);
  assert.equal(policy.trustedMutation(req(undefined,"same-origin")),true);
  assert.equal(policy.trustedMutation(req()),false);
  assert.equal(policy.trustedMutation(req(undefined,"cross-site")),false);
});
test("message/assistant UUID validation prevents SQL identifier injection",()=>{
  assert.equal(policy.validateUuid(crypto.randomUUID()),true);
  assert.equal(policy.validateUuid("1;DROP TABLE users"),false);
  assert.equal(policy.validateUuid(""),false);
  assert.equal(policy.validModel("glm"),true);
  assert.equal(policy.validModel("glm'}"),false);
});
test("vault uses randomized AEAD, fails on wrong identity and forged bytes",()=>{
  const env={OSA_JEFF_MASTER_KEY:crypto.randomBytes(32).toString("base64")};
  const text="sk-test-private-do-not-log";
  const a=vault.encrypt(text,"google-sub-1","openai",env);
  const b=vault.encrypt(text,"google-sub-1","openai",env);
  assert.notEqual(a,b);
  assert.notEqual(a.includes(text),true);
  assert.equal(vault.decrypt(a,"google-sub-1","openai",env),text);
  assert.throws(()=>vault.decrypt(a,"google-sub-2","openai",env));
  assert.throws(()=>vault.decrypt(a,"google-sub-1","google",env));
  assert.throws(()=>vault.decrypt(a.slice(0,-3)+"XYZ","google-sub-1","openai",env));
  assert.throws(()=>vault.encrypt(text,"sub","openai",{}),/VAULT_NOT_CONFIGURED/);
});
test("migration requires RLS with FORCE on all P0 tenant tables",()=>{
  const sql=fs.readFileSync(path.join(__dirname,"../db/migrations/001_osa_jeff_ready_p0.sql"),"utf8");
  for(const table of ["users","conversations","messages","chat_turns","user_credentials"]){
    assert.match(sql,new RegExp("ALTER TABLE "+table+" ENABLE ROW LEVEL SECURITY;"));
    assert.match(sql,new RegExp("ALTER TABLE "+table+" FORCE ROW LEVEL SECURITY;"));
    assert.match(sql,new RegExp("ON "+table+" FOR ALL"));
  }
  assert.match(sql,/current_setting\('app.user_id', true\)/);
  assert.match(sql,/UNIQUE \(user_id, client_request_id\)/);
  assert.match(sql,/only_one_active_reply/);
  assert.match(sql,/ordinal bigint GENERATED ALWAYS AS IDENTITY/);
  assert.match(sql,/messages_conversation_order ON messages \(conversation_id, ordinal\)/);
});
test("active client never reads, stores, or transmits JEFF_CHAT_ACCESS_TOKEN",()=>{
  const root=path.join(__dirname,"../components/agent-chat");
  const files=["App.tsx","hooks/useChat.ts","services/adapters/persistent.ts","features/settings/Settings.tsx"];
  for(const rel of files){
    const code=fs.readFileSync(path.join(root,rel),"utf8");
    assert.doesNotMatch(code,/glmAccessToken/);
    assert.doesNotMatch(code,/localStorage/);
    assert.doesNotMatch(code,/Authorization:\s*["']Bearer/);
  }
});
