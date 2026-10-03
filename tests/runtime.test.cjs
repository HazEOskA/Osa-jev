const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../lib/cockpit-runtime.cjs");
const originalFetch = global.fetch;
const originalEnv = { NVIDIA_API_KEY: process.env.NVIDIA_API_KEY, OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY };
after(() => { global.fetch = originalFetch; for(const [k,v] of Object.entries(originalEnv)) { if(v===undefined) delete process.env[k]; else process.env[k]=v } });
function reset() { delete process.env.NVIDIA_API_KEY; delete process.env.OPENROUTER_API_KEY }
async function run(body, method="POST") {
  let code=200, payload;
  await handler({method,body,query:{}},{setHeader(){},status(n){code=n;return this},json(v){payload=v}});
  return {code,payload};
}
test("brak kluczy: jawny brak konfiguracji, digest i brak wywołań sieci",async()=>{
  reset();global.fetch=()=>{throw Error("unexpected network")};
  const {payload}=await run({message:"Zrób plan pracy"});
  assert.equal(payload.receipt.generation_status,"NOT_CONFIGURED");
  assert.equal(payload.receipt.provider,"none");
  assert.equal(payload.route.workflow,"plan");
  assert.match(payload.receipt.output_digest,/^[a-f0-9]{64}$/);
});
test("działania zewnętrzne pozostają REVIEW_REQUIRED",async()=>{
  reset(); const {payload}=await run({message:"Wyślij wiadomość klientowi"});
  assert.equal(payload.receipt.authority_gate,"REVIEW_REQUIRED");
});
test("walidacja odrzuca puste i zbyt długie wiadomości",async()=>{
  reset();assert.equal((await run({message:""})).code,400);
  assert.equal((await run({message:"a".repeat(20001)})).code,413);
});
test("jawny NVIDIA bez modelu używa domyślnego modelu",async()=>{
  reset();process.env.NVIDIA_API_KEY="fake-test";
  global.fetch=async(url,opts)=>{assert.match(url,/nvidia/);assert.ok(JSON.parse(opts.body).model);return new Response(JSON.stringify({choices:[{message:{content:"Odpowiedź testowa"}}],model:"test/model"}))};
  const {payload}=await run({message:"Pomóż mi z analizą",provider:"nvidia"});
  assert.equal(payload.receipt.generation_status,"SUCCEEDED");
  assert.equal(payload.answer,"Odpowiedź testowa");
});
test("błąd Jev nie blokuje generowania przez OpenRouter",async()=>{
  reset();process.env.OPENROUTER_API_KEY="fake-test";
  global.fetch=async(url)=>url.includes("decisions")?new Response(JSON.stringify({error:{message:"test unavailable"}}),{status:503}):new Response(JSON.stringify({choices:[{message:{content:"Plan testowy"}}],model:"test/model"}));
  const {payload}=await run({message:"Zrób plan",provider:"openrouter"});
  assert.equal(payload.route.source,"fallback_after_jev_error");
  assert.equal(payload.receipt.generation_status,"SUCCEEDED");
});
test("pusta odpowiedź providera ma status FAILED",async()=>{
  reset();process.env.NVIDIA_API_KEY="fake-test";
  global.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:""}}]}));
  const {payload}=await run({message:"Pomóż mi",provider:"nvidia"});
  assert.equal(payload.receipt.generation_status,"FAILED");
  assert.equal(payload.receipt.provider,"none");
});
