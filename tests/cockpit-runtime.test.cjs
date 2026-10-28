const {test}=require("node:test");
const assert=require("node:assert/strict");

// Zero prawdziwych żądań i kosztów API: testujemy realny handler z kontrolowanym fetch.
process.env.NVIDIA_API_KEY="test-nvidia-no-real-token";
process.env.OPENROUTER_API_KEY="test-openrouter-no-real-token";
const handler=require("../lib/cockpit-runtime.cjs");

const response=(body,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)});
async function execute(body){
  const state={status:200,payload:null};
  const res={
    setHeader(){return this},
    status(code){state.status=code;return this},
    json(payload){state.payload=payload;return this}
  };
  await handler({method:"POST",body,query:{}},res);
  return state;
}
const body={message:"Napisz po polsku krótką odpowiedź testową.",provider:"auto",mode:"chat"};
const oldFetch=global.fetch;

test("NVIDIA HTTP 404 -> OpenRouter free router -> rzeczywisty sukces",async()=>{
  const calls=[];
  global.fetch=async(url,opts={})=>{
    const address=String(url);
    if(address.includes("/api/alpha/decisions"))return response({error:{message:"JEV unavailable"}},503);
    if(address.startsWith("https://integrate.api.nvidia.com/v1/models"))
      return response({data:[{id:"nvidia/nemotron-3-super-120b-a12b"}]});
    if(address==="https://openrouter.ai/api/v1/models")return response({data:[]});
    if(address.includes("integrate.api.nvidia.com/v1/chat/completions")){
      calls.push("nvidia");
      return response({detail:"Function not found for account"},404);
    }
    if(address.includes("openrouter.ai/api/v1/chat/completions")){
      const model=JSON.parse(opts.body).model;
      calls.push(model);
      return response({model:"nvidia/nemotron-test:free",choices:[{message:{content:"Odpowiedź testowa OSA-JEV"}}]});
    }
    throw Error("Unexpected fetch "+address);
  };
  try{
    const r=await execute(body);
    assert.equal(r.status,200);
    assert.equal(r.payload.ok,true);
    assert.equal(r.payload.answer,"Odpowiedź testowa OSA-JEV");
    assert.equal(r.payload.receipt.provider,"openrouter");
    assert.equal(r.payload.receipt.generation_status,"SUCCEEDED");
    assert.equal(r.payload.receipt.verified,"EXECUTION_RECORDED");
    assert.deepEqual(calls,["nvidia","openrouter/free"]);
  }finally{global.fetch=oldFetch}
});

test("Brak działających modeli -> HTTP 503, ok false i FAILED receipt",async()=>{
  global.fetch=async(url)=>{
    const address=String(url);
    if(address.includes("/api/alpha/decisions"))return response({error:"not available"},503);
    if(address.includes("integrate.api.nvidia.com/v1/models"))return response({data:[{id:"nvidia/nemotron-3-super-120b-a12b"}]});
    if(address.includes("openrouter.ai/api/v1/models"))return response({data:[]});
    if(address.includes("integrate.api.nvidia.com/v1/chat/completions"))return response({detail:"not found"},404);
    if(address.includes("openrouter.ai/api/v1/chat/completions"))return response({error:{message:"Provider returned error"}},503);
    throw Error("Unexpected fetch "+address);
  };
  try{
    const r=await execute(body);
    assert.equal(r.status,503);
    assert.equal(r.payload.ok,false);
    assert.equal(r.payload.receipt.generation_status,"FAILED");
    assert.equal(r.payload.receipt.provider,"none");
    assert.match(r.payload.answer,/RUNTIME ERROR/);
    assert.ok(r.payload.receipt.provider_errors.some(s=>s.includes("HTTP 404")));
    assert.ok(r.payload.receipt.provider_errors.some(s=>s.includes("Provider returned error")));
  }finally{global.fetch=oldFetch}
});

test("Brak kluczy providerów -> HTTP 503, NOT_CONFIGURED",async()=>{
  const nvidia=process.env.NVIDIA_API_KEY,router=process.env.OPENROUTER_API_KEY;
  delete process.env.NVIDIA_API_KEY;delete process.env.OPENROUTER_API_KEY;
  global.fetch=async()=>{throw Error("No network expected")};
  try{
    const r=await execute(body);
    assert.equal(r.status,503);
    assert.equal(r.payload.ok,false);
    assert.equal(r.payload.receipt.generation_status,"NOT_CONFIGURED");
    assert.match(r.payload.answer,/RUNTIME OFFLINE/);
  }finally{
    process.env.NVIDIA_API_KEY=nvidia;
    process.env.OPENROUTER_API_KEY=router;
    global.fetch=oldFetch;
  }
});

test("Ręczny wybór OpenRouter zachowuje model użytkownika",async()=>{
  global.fetch=async(url,opts={})=>{
    const address=String(url);
    if(address.includes("/api/alpha/decisions"))return response({error:"JEV unavailable"},503);
    if(address.includes("openrouter.ai/api/v1/chat/completions")){
      const actual=JSON.parse(opts.body).model;
      assert.equal(actual,"example/selected:free");
      return response({model:actual,choices:[{message:{content:"Wybrany model działa"}}]});
    }
    throw Error("Unexpected fetch "+address);
  };
  try{
    const r=await execute({...body,provider:"openrouter",model:"example/selected:free"});
    assert.equal(r.status,200);
    assert.equal(r.payload.receipt.model,"example/selected:free");
    assert.equal(r.payload.receipt.generation_status,"SUCCEEDED");
  }finally{global.fetch=oldFetch}
});
