"use strict";
const providers = Object.freeze({
  explabs: {name:"Experiential Labs",base:"https://api.experientiallabs.ai/v1",key:"EXPLABS_API_KEY"},
  nvidia: {name:"NVIDIA",base:"https://integrate.api.nvidia.com/v1",key:"NVIDIA_API_KEY"},
  openrouter: {name:"OpenRouter",base:"https://openrouter.ai/api/v1",key:"OPENROUTER_API_KEY"},
});
const validId = id => typeof id === "string" && /^[a-zA-Z0-9._:/-]{2,100}$/.test(id);
const standardId = id => validId(id) && !/(?:uncensored|abliterated|unrestricted|jailbreak|no[-_]?guard)/i.test(id);
function selection(value,env=process.env) {
  if(typeof value !== "string") throw Error("Nieprawidłowy wybór modelu.");
  const sep=value.indexOf("|"), provider=value.slice(0,sep), model=value.slice(sep+1);
  if(sep<1 || !Object.hasOwn(providers,provider) || !standardId(model)) throw Error("Nieprawidłowy wybór modelu.");
  const config=providers[provider];
  return {provider,model,config,key:env[config.key]};
}
function price(value) {
  if(value===undefined||value===null||value==="")return null;
  const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;
}
async function catalog(env=process.env,fetcher=fetch,publicOnly=false) {
  const groups=await Promise.all(Object.entries(providers).map(async ([provider,config])=>{
    const key=env[config.key];
    if(!key&&!publicOnly)return {provider,name:config.name,status:"missing",models:[]};
    try {
      const endpoint=publicOnly&&provider==="explabs"?"https://api.experientiallabs.ai/api/v1/models":config.base+"/models";
      const response=await fetcher(endpoint,{headers:{...(!publicOnly?{Authorization:"Bearer "+key}:{}),Accept:"application/json"},...(publicOnly?{next:{revalidate:300}}:{cache:"no-store"}),signal:AbortSignal.timeout(12000)});
      if(!response.ok)return {provider,name:config.name,status:"error",http:response.status,models:[]};
      const data=await response.json();
      const list=Array.isArray(data.data)?data.data:Array.isArray(data.models)?data.models:Array.isArray(data)?data:null;
      if(!list)throw Error("Invalid catalog");
      const seen=new Set(), models=[];
      for(const row of list){
        const id=publicOnly&&provider==="explabs"&&typeof row?.id==="string"?row.id.split("/").slice(1).join("/")||row.id:row?.id;
        if(!standardId(id)||seen.has(id)||/(?:embed(?:ding)?|rerank|transcrib|text-to-speech|speech-to-text)/i.test(id))continue;
        const out=row.architecture?.output_modalities??row.output_modalities;
        if(Array.isArray(out)&&out.length&&!out.includes("text"))continue;
        seen.add(id);
        const prompt=price(row.pricing?.prompt),completion=price(row.pricing?.completion);
        models.push({id:provider+"|"+id,model:id,provider,name:typeof row.name==="string"?row.name.slice(0,180):id,prompt,completion,free:prompt===0&&completion===0});
      }
      models.sort((a,b)=>a.name.localeCompare(b.name));
      return {provider,name:config.name,status:models.length?"ready":"empty",models};
    }catch{return {provider,name:config.name,status:"error",models:[]}}
  }));
  return {groups,scope:publicOnly?"public":"account"};
}
module.exports={providers,selection,catalog};
