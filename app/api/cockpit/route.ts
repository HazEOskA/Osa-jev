import handler from "@/lib/cockpit-runtime.cjs"
export const runtime = "nodejs"
export const maxDuration = 90
export const dynamic = "force-dynamic"

async function invoke(request: Request) {
  let body = {}
  if (request.method === "POST") {
    if (Number(request.headers.get("content-length") || 0) > 100000) {
      return Response.json({ error: "Zbyt duże żądanie" }, { status: 413 })
    }
    try { body = await request.json() }
    catch { return Response.json({ error: "Nieprawidłowy JSON" }, { status: 400 }) }
  }
  let status = 200
  const headers: Record<string,string> = {}
  let payload: unknown
  const res = {
    setHeader(name: string, value: string) { headers[name] = value },
    status(value: number) { status = value; return this },
    json(value: unknown) { payload = value },
  }
  try {
    await handler({ method: request.method, body, query: Object.fromEntries(new URL(request.url).searchParams) }, res)
    return Response.json(payload, { status, headers })
  } catch {
    return Response.json({ error: "Błąd runtime. Spróbuj ponownie." }, { status: 500 })
  }
}
export const GET = invoke
export const POST = invoke
