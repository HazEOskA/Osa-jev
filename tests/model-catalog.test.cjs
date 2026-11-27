const {test}=require("node:test");
const assert=require("node:assert/strict");
const {catalog,selection}=require("../lib/model-catalog.cjs");
test("catalog: configured providers, unknown pricing and fixed hosts",async()=>{
 const env={EXPLABS_API_KEY:"fake-a",NVIDIA_API_KEY:"fake-b",OPENROUTER_API_KEY:"fake-c"};
 const calls=[];
 const d=await catalog(env,async(url,opts)=>{calls.push(url);assert.match(opts.headers.Authorization,/^Bearer fake-/);return Response.json({data:[{id:"qwen/test",pricing:{prompt:"0",completion:"0"}},{id:"deepseek/test"},{id:"embed/test"},{id:"qwen/test"}]})});
 assert.equal(calls.length,3);assert.equal(d.groups.length,3);
 for(const g of d.groups){assert.equal(g.status,"ready");assert.equal(g.models.length,2);assert.equal(g.models.find(m=>m.model==="qwen/test").free,true);assert.equal(g.models.find(m=>m.model==="deepseek/test").free,false);}
 assert.ok(!JSON.stringify(d).includes("fake-"));
});
test("selection: fixed provider endpoint and validated ID",()=>{
 assert.equal(selection("nvidia|qwen/test",{NVIDIA_API_KEY:"fake"}).config.base,"https://integrate.api.nvidia.com/v1");
 assert.throws(()=>selection("other|qwen/test",{}));assert.throws(()=>selection("nvidia|https://evil.invalid?x=1",{}));
});
test("catalog isolates failed providers and missing keys",async()=>{
 const d=await catalog({EXPLABS_API_KEY:"fake",NVIDIA_API_KEY:"fake"},async url=>url.includes("nvidia")?Response.json({data:[{id:"qwen/test"}]}):new Response("",{status:401}));
 assert.deepEqual(d.groups.map(g=>g.status),["error","ready","missing"]);
});
