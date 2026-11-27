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
 if(!core.checkAccess(request.headers.get("authorization"),secret)&&!(session.verifySession(cookie,secret)&&session.sameOrigin(request)))return Response.json({error:"Zaloguj się do OSA Jeff."},{status:401,headers})
 return Response.json(await models.catalog(),{headers})
}
