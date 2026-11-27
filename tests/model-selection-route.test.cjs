const {test,after}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),ts=require("typescript");
const source=path.join(__dirname,"../app/api/glm-chat/route.ts"),target=path.join(__dirname,"../app/api/glm-chat/.test-model-selection.cjs");
fs.writeFileSync(target,ts.transpileModule(fs.readFileSync(source,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
const {POST}=require(target);
after(()=>fs.unlinkSync(target));
test("selected NVIDIA and OpenRouter receive exact model and full context; no fallback",async()=>{
 const oldFetch=global.fetch,token="test-only-session-token-123456";
 const original={...process.env};
 try{process.env.JEFF_CHAT_ACCESS_TOKEN=token;process.env.NVIDIA_API_KEY="fake-nvidia";process.env.OPENROUTER_API_KEY="fake-router";
 const messages=[{role:"user",content:"Moje imię to Jan."},{role:"assistant",content:"Rozumiem."},{role:"user",content:"Jak mam na imię?"}];
 for(const [provider,host,key] of [["nvidia","https://integrate.api.nvidia.com/v1","fake-nvidia"],["openrouter","https://openrouter.ai/api/v1","fake-router"]]){
 global.fetch=async(url,opts)=>{assert.equal(url,host+"/chat/completions");assert.equal(opts.headers.Authorization,"Bearer "+key);const body=JSON.parse(opts.body);assert.equal(body.model,"qwen/test");assert.deepEqual(body.messages.slice(1),messages);return new Response("data: [DONE]\n\n",{headers:{"content-type":"text/event-stream"}})};
 const r=await POST(new Request("https://test.invalid/api/glm-chat",{method:"POST",headers:{Authorization:"Bearer "+token},body:JSON.stringify({selection:provider+"|qwen/test",messages})}));assert.equal(r.status,200);
 }
 }finally{global.fetch=oldFetch;for(const k of ["JEFF_CHAT_ACCESS_TOKEN","NVIDIA_API_KEY","OPENROUTER_API_KEY"]){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}}
});
