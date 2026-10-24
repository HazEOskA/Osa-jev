import type { NextRequest } from "next/server"

const core = require("../../../lib/glm-chat-core.cjs") as {
  MODEL: string
  checkAccess: (header: string | null, secret: string | undefined) => boolean
  makeCompletion: (payload: unknown, env?: NodeJS.ProcessEnv) => unknown
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 90

const headers = { "Cache-Control": "no-store" }

export async function POST(request: NextRequest) {
  const secret = process.env.JEFF_CHAT_ACCESS_TOKEN
  if (!secret || secret.length < 16) {
    return Response.json({ error: "Czat wyłączony: administrator musi skonfigurować JEFF_CHAT_ACCESS_TOKEN." }, { status: 503, headers })
  }
  if (!core.checkAccess(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Odmowa dostępu do czatu." }, { status: 401, headers })
  }
  const apiKey = process.env.EXPLABS_API_KEY
  if (!apiKey) {
    return Response.json({ error: "Brak EXPLABS_API_KEY na serwerze." }, { status: 503, headers })
  }
  if (Number(request.headers.get("content-length") || 0) > 300_000) {
    return Response.json({ error: "Żądanie jest zbyt duże." }, { status: 413, headers })
  }
  let completion: unknown
  try {
    const raw = await request.text()
    if (raw.length > 300_000) return Response.json({ error: "Żądanie jest zbyt duże." }, { status: 413, headers })
    completion = core.makeCompletion(JSON.parse(raw))
  } catch (err) {
    return Response.json({ error: err instanceof Error && err instanceof SyntaxError ? "Nieprawidłowy JSON." : err instanceof Error ? err.message : "Błędne dane." }, { status: 400, headers })
  }
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(80_000)])
    const upstream = await fetch("https://api.experientiallabs.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
      },
      body: JSON.stringify(completion),
      signal,
      cache: "no-store",
    })
    if (!upstream.ok) {
      const messages: Record<number, string> = {
        400: "Dostawca odrzucił parametry zapytania.",
        401: "Dostawca odrzucił klucz EXPLABS_API_KEY.",
        402: "Brak środków lub wymagane potwierdzenie płatności w Experiential Labs.",
        403: "Model niedostępny dla tego konta.",
        404: "Model nie został znaleziony. Sprawdź EXPLABS_MODEL.",
        429: "Limit zapytań lub środków u dostawcy został osiągnięty.",
      }
      await upstream.body?.cancel().catch(() => {})
      return Response.json({ error: messages[upstream.status] || `Błąd dostawcy (HTTP ${upstream.status}).` }, { status: upstream.status === 429 ? 429 : 502, headers })
    }
    if (!upstream.body || !upstream.headers.get("content-type")?.includes("text/event-stream")) {
      await upstream.body?.cancel().catch(() => {})
      return Response.json({ error: "Dostawca nie zwrócił strumienia SSE." }, { status: 502, headers })
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")
    return Response.json({ error: timedOut ? "Połączenie zostało przerwane lub przekroczono czas." : "Błąd połączenia z dostawcą GLM." }, { status: timedOut ? 504 : 502, headers })
  }
}

export async function GET() {
  return Response.json({ ok: true, configured: Boolean(process.env.EXPLABS_API_KEY && process.env.JEFF_CHAT_ACCESS_TOKEN), model: process.env.EXPLABS_MODEL || core.MODEL }, { headers })
}