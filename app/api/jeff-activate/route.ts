import {NextResponse,type NextRequest} from "next/server";
const activation=require("../../../lib/jeff-activation.cjs") as {
  HOST:string;verifyActivation:(proof:unknown,key:string|undefined,host:string,now?:number)=>boolean;
};
const session=require("../../../lib/jeff-session.cjs") as {
  COOKIE:string;TTL_SECONDS:number;createSession:(secret:string)=>string;sameOrigin:(request:Request)=>boolean;
};
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={
  "Cache-Control":"no-store",
  "Referrer-Policy":"no-referrer",
  "X-Content-Type-Options":"nosniff",
};
export async function POST(request:NextRequest){
  if(!session.sameOrigin(request))return NextResponse.json({error:"Odmowa dostępu."},{status:403,headers});
  if(request.nextUrl.host!==activation.HOST)return NextResponse.json({error:"Nieprawidłowy adres."},{status:403,headers});
  if(!request.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json({error:"Nieprawidłowe żądanie."},{status:415,headers});
  if(Number(request.headers.get("content-length")||0)>1024)
    return NextResponse.json({error:"Nieprawidłowe żądanie."},{status:413,headers});
  const secret=process.env.JEFF_CHAT_ACCESS_TOKEN;
  const activator=process.env.JEFF_ACTIVATION_SECRET;
  if(!secret||secret.length<16||!activator)
    return NextResponse.json({error:"Aktywacja niedostępna."},{status:503,headers});
  let proof:unknown;
  try{
    const raw=await request.text();
    if(raw.length>1024)return NextResponse.json({error:"Nieprawidłowe żądanie."},{status:413,headers});
    proof=(JSON.parse(raw) as {proof?:unknown}).proof;
  }catch{return NextResponse.json({error:"Nieprawidłowe żądanie."},{status:400,headers});}
  if(!activation.verifyActivation(proof,activator,request.nextUrl.host))
    return NextResponse.json({error:"Link jest nieważny lub wygasł."},{status:401,headers});
  const response=NextResponse.json({ok:true,authenticated:true},{headers});
  response.cookies.set(session.COOKIE,session.createSession(secret),{
    httpOnly:true,secure:true,sameSite:"strict",path:"/",maxAge:session.TTL_SECONDS,
  });
  return response;
}
