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

test("płatny model blokowany bez wywołania chatu",async()=>{
  reset();process.env.OPENROUTER_API_KEY="fake-test";const called=[];
  global.fetch=async(url)=>{called.push(url);
    if(url.includes("decisions"))return new Response(JSON.stringify({answers:{workflow:{choice:"general_advice"}}}));
    if(url.endsWith("/models"))return new Response(JSON.stringify({data:[{id:"vendor/paid",pricing:{prompt:"0.2",completion:"1"}}]}));
    throw Error("paid chat must not be invoked");
  };
  const {payload}=await run({message:"Pomóż mi",provider:"openrouter",model:"vendor/paid"});
  assert.equal(payload.receipt.failure_reason,"MODEL_NOT_FREE_OR_UNAVAILABLE");
  assert.deepEqual(payload.receipt.attempted_models,[]);
  assert.ok(!called.some(url=>url.includes("chat/completions")));
});
test("wycofany slug jest pominięty na rzecz nowego modelu free",async()=>{
  reset();process.env.OPENROUTER_API_KEY="fake-test";const called=[];
  global.fetch=async(url,opts)=>{
    if(url.includes("decisions"))return new Response(JSON.stringify({answers:{workflow:{choice:"general_advice"}}}));
    if(url.endsWith("/models"))return new Response(JSON.stringify({data:[{id:"qwen/qwen3.8-27b",pricing:{prompt:"0.1",completion:"0.2"}},{id:"community/new:free",pricing:{prompt:"0",completion:"0"}}]}));
    called.push(JSON.parse(opts.body).model);
    return new Response(JSON.stringify({choices:[{message:{content:"OK"}}],model:called.at(-1)}));
  };
  const {payload}=await run({message:"Pomóż mi",provider:"openrouter"});
  assert.equal(payload.receipt.generation_status,"SUCCEEDED");
  assert.deepEqual(called,["community/new:free"]);
});
test("fallback OpenRouter próbuje wyłącznie darmowe modele",async()=>{
  reset();process.env.OPENROUTER_API_KEY="fake-test";const called=[];
  global.fetch=async(url,opts)=>{
    if(url.includes("decisions"))return new Response(JSON.stringify({answers:{workflow:{choice:"plan"}}}));
    if(url.endsWith("/models"))return new Response(JSON.stringify({data:[{id:"qwen/qwen3.8-27b:free",pricing:{prompt:"0",completion:"0"}},{id:"community/new:free",pricing:{prompt:"0",completion:"0"}},{id:"vendor/paid",pricing:{prompt:"0.1",completion:"1"}}]}));
    const model=JSON.parse(opts.body).model;called.push(model);
    return model==="qwen/qwen3.8-27b:free"?new Response(JSON.stringify({error:{message:"This model is unavailable for free"}}),{status:404}):new Response(JSON.stringify({choices:[{message:{content:"OK"}}],model}));
  };
  const {payload}=await run({message:"Zrób plan",provider:"openrouter"});
  assert.equal(payload.receipt.generation_status,"SUCCEEDED");
  assert.deepEqual(called,["qwen/qwen3.8-27b:free","community/new:free"]);
  assert.ok(!called.includes("vendor/paid"));
});
test("gdy katalog niedostępny, wolno użyć tylko free routera",async()=>{
  reset();process.env.OPENROUTER_API_KEY="fake-test";const called=[];
  global.fetch=async(url,opts)=>{
    if(url.includes("decisions"))return new Response(JSON.stringify({answers:{workflow:{choice:"general_advice"}}}));
    if(url.endsWith("/models"))return new Response(JSON.stringify({error:"down"}),{status:503});
    called.push(JSON.parse(opts.body).model);
    return new Response(JSON.stringify({choices:[{message:{content:"OK"}}],model:"openrouter/free"}));
  };
  const {payload}=await run({message:"Wyjaśnij",provider:"openrouter"});
  assert.equal(payload.receipt.generation_status,"SUCCEEDED");
  assert.deepEqual(called,["openrouter/free"]);
});
test("AUTO nie wywołuje NVIDIA bez jawnego wyboru",async()=>{
  reset();process.env.NVIDIA_API_KEY="fake-test";
  global.fetch=async()=>{throw Error("unexpected network")};
  const {payload}=await run({message:"Wyjaśnij",provider:"auto"});
  assert.equal(payload.receipt.generation_status,"NOT_CONFIGURED");
  assert.deepEqual(payload.receipt.attempted_models,[]);
});
test("brak pricing nie autoryzuje modelu free",async()=>{
  reset();process.env.OPENROUTER_API_KEY="fake-test";const called=[];
  global.fetch=async(url,opts)=>{
    if(url.includes("decisions"))return new Response(JSON.stringify({answers:{workflow:{choice:"general_advice"}}}));
    if(url.endsWith("/models"))return new Response(JSON.stringify({data:[{id:"vendor/trap:free",pricing:{}}]}));
    called.push(JSON.parse(opts.body).model);
    return new Response(JSON.stringify({choices:[{message:{content:"OK"}}],model:"openrouter/free"}));
  };
  await run({message:"Wyjaśnij",provider:"openrouter"});
  assert.deepEqual(called,["openrouter/free"]);
});
