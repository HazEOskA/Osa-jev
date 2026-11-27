const {test}=require("node:test");
const assert=require("node:assert/strict");
const {catalog}=require("../lib/model-catalog.cjs");
test("public catalog has real provider IDs without exposing or transmitting credentials",async()=>{
 const calls=[];
 const d=await catalog({EXPLABS_API_KEY:"secret",NVIDIA_API_KEY:"secret",OPENROUTER_API_KEY:"secret"},async(url,opts)=>{
 calls.push(url);assert.equal(opts.headers.Authorization,undefined);
 return Response.json({data:[{id:url.includes("experiential")?"qwen/qwen-test":"qwen/test"}]});
 },true);
 assert.equal(d.scope,"public");assert.equal(calls.length,3);assert.equal(d.groups[0].models[0].id,"explabs|qwen-test");assert.equal(d.groups[1].models[0].id,"nvidia|qwen/test");assert.equal(d.groups[2].models[0].id,"openrouter|qwen/test");assert.ok(!JSON.stringify(d).includes("secret"));
});
