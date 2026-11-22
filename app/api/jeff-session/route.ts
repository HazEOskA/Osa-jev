import {NextResponse, type NextRequest} from "next/server";
import {cookies} from "next/headers";
const core = require("../../../lib/glm-chat-core.cjs") as {checkAccess:(header:string|null,secret:string|undefined)=>boolean};
const session = require("../../../lib/jeff-session.cjs") as {
  COOKIE:string; TTL_SECONDS:number; createSession:(secret:string)=>string;
  verifySession:(value:string|undefined,secret:string|undefined)=>boolean;
  sameOrigin:(request:Request)=>boolean;
};
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const config=()=>process.env.JEFF_CHAT_ACCESS_TOKEN;
export async function GET() {
  const stored=(await cookies()).get(session.COOKIE)?.value;
  return NextResponse.json({ok:true,authenticated:session.verifySession(stored,config())},{headers});
}
export async function POST(request:NextRequest) {
  if(!session.sameOrigin(request)) return NextResponse.json({error:"Niedozwolone pochodzenie."},{status:403,headers});
  if(Number(request.headers.get("content-length")||0)>2048) return NextResponse.json({error:"Nieprawidłowe żądanie."},{status:413,headers});
  const expected=config();
  if(!expected || expected.length<16) return NextResponse.json({error:"Dostęp nie jest skonfigurowany."},{status:503,headers});
  let token="";
  try {
    const raw=await request.text();
    if(raw.length>2048) return NextResponse.json({error:"Nieprawidłowe żądanie."},{status:413,headers});
    const body=JSON.parse(raw);
    token=typeof body.token==="string"?body.token:"";
  } catch {return NextResponse.json({error:"Nieprawidłowe żądanie."},{status:400,headers});}
  if(!core.checkAccess("Bearer "+token,expected)) return NextResponse.json({error:"Niepoprawny token dostępu."},{status:401,headers});
  const value=session.createSession(expected);
  const response=NextResponse.json({ok:true,authenticated:true},{headers});
  response.cookies.set(session.COOKIE,value,{httpOnly:true,secure:true,sameSite:"strict",path:"/",maxAge:session.TTL_SECONDS});
  return response;
}
export async function DELETE(request:NextRequest) {
  if(!session.sameOrigin(request)) return NextResponse.json({error:"Niedozwolone pochodzenie."},{status:403,headers});
  const response=NextResponse.json({ok:true,authenticated:false},{headers});
  response.cookies.set(session.COOKIE,"",{httpOnly:true,secure:true,sameSite:"strict",path:"/",maxAge:0});
  return response;
}
