const {test,after}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),ts=require("typescript");
const source=path.join(__dirname,"../app/api/models/route.ts"),target=path.join(__dirname,"../app/api/models/.test-session.cjs");
fs.writeFileSync(target,ts.transpileModule(fs.readFileSync(source,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
const {GET}=require(target);
const {createSession}=require("../lib/jeff-session.cjs");
after(()=>fs.unlinkSync(target));
test("catalog accepts existing signed mobile session without optional Origin headers, rejects absent and cross-site",async()=>{
 const token="test-only-session-token-123456",old=process.env.JEFF_CHAT_ACCESS_TOKEN,oldFetch=global.fetch;
 process.env.JEFF_CHAT_ACCESS_TOKEN=token;
 global.fetch=async()=>Response.json({data:[]});
 const req=(cookie,headers={})=>({url:"https://osa-jev.vercel.app/api/models",headers:new Headers(headers),cookies:{get:()=>cookie?{value:cookie}:undefined}});
 try{const signed=createSession(token);assert.equal((await GET(req(signed))).status,200);assert.equal((await GET(req())).status,401);assert.equal((await GET(req(signed,{"sec-fetch-site":"cross-site"}))).status,403);assert.equal((await GET(req(signed,{origin:"https://other.invalid"}))).status,403);}
 finally{global.fetch=oldFetch;if(old===undefined)delete process.env.JEFF_CHAT_ACCESS_TOKEN;else process.env.JEFF_CHAT_ACCESS_TOKEN=old;}
});
test("model dialog uses native top layer instead of clipped composer child",()=>{
 const ui=fs.readFileSync(path.join(__dirname,"../components/agent-chat/components/ModelSelector.tsx"),"utf8");
 assert.match(ui,/createPortal/);assert.match(ui,/showModal\(\)/);assert.match(ui,/document\.body/);
});
