"use strict";
const {randomBytes,createHmac,timingSafeEqual}=require("node:crypto");
const VALID_MS=5*60*1000;
const HOST="osa-jev-git-feat-jeff-quick-access-p0-osabarca-1680s-projects.vercel.app";
function getKey(secret){
  if(typeof secret!=="string"||!/^[0-9a-f]{64}$/.test(secret))throw Error("ACTIVATION_NOT_CONFIGURED");
  return Buffer.from(secret,"hex");
}
function createActivation(secret, now=Date.now()){
  const raw=Buffer.from(JSON.stringify({v:1,exp:now+VALID_MS,host:HOST,nonce:randomBytes(20).toString("base64url")})).toString("base64url");
  const sig=createHmac("sha256",getKey(secret)).update(raw).digest("base64url");
  return raw+"."+sig;
}
function verifyActivation(value,secret,host,now=Date.now()){
  if(typeof value!=="string"||value.length>512||!/^[A-Za-z0-9_-]{40,460}\.[A-Za-z0-9_-]{43}$/.test(value))return false;
  if(typeof host!=="string"||host!==HOST)return false;
  let key;try{key=getKey(secret);}catch{return false;}
  const [raw,sig]=value.split(".");
  const provided=Buffer.from(sig,"base64url");
  if(provided.toString("base64url")!==sig)return false;
  const expected=createHmac("sha256",key).update(raw).digest();
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected))return false;
  try{
    const p=JSON.parse(Buffer.from(raw,"base64url").toString("utf8"));
    return p.v===1&&p.host===HOST&&typeof p.nonce==="string"&&
      /^[A-Za-z0-9_-]{27}$/.test(p.nonce)&&Number.isSafeInteger(p.exp)&&
      p.exp>now&&p.exp<=now+VALID_MS;
  }catch{return false;}
}
module.exports={HOST,VALID_MS,createActivation,verifyActivation};
