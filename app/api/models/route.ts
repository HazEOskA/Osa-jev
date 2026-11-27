import type { NextRequest } from "next/server"
const session=require("../../../lib/jeff-session.cjs")
const core=require("../../../lib/glm-chat-core.cjs")
const models=require("../../../lib/model-catalog.cjs")
export const runtime="nodejs"
export const dynamic="force-dynamic"
export const maxDuration=20
export async function GET(request:NextRequest){
 const headers={"Cache-Control":"no-store"}
 const secret=process.env.JEFF_CHAT_ACCESS_TOKEN
 if(!secret||secret.length<16)return Response.json({error:"Dostęp nie jest skonfigurowany."},{status:503,headers})
 const cookie=request.cookies.get(session.COOKIE)?.value
 // Read-only same-origin requests may omit Origin and Sec-Fetch-Site (mobile WebViews).
 // Reject explicit cross-origin requests, but don't require headers that are optional for GET.
 const origin=request.headers.get("origin")
 const site=request.headers.get("sec-fetch-site")
 if((origin&&origin!==new URL(request.url).origin)||site==="cross-site")return Response.json({error:"Niedozwolone pochodzenie."},{status:403,headers})
 if(!core.checkAccess(request.headers.get("authorization"),secret)&&!session.verifySession(cookie,secret))return Response.json({error:"Brak aktywnej sesji OSA Jeff."},{status:401,headers})
 return Response.json(await models.catalog(),{headers})
}
