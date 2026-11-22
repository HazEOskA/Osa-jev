import { AccessError } from "./account";
import { StoreError } from "./chat-store";
const policy = require("@/lib/osa-jeff/policy.cjs") as {
  trustedMutation: (request: Request) => boolean;
  validateUuid: (value: unknown) => boolean;
};
export const noStore = { "Cache-Control": "no-store" };
export function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: noStore });
}
export function fail(error: unknown): Response {
  if (error instanceof AccessError) {
    return json({ error: error.code === "NOT_CONFIGURED" ? "Konfiguracja logowania lub bazy nie jest gotowa." :
      error.code === "FORBIDDEN" ? "Brak uprawnień." : "Zaloguj się ponownie." },
    error.code === "NOT_CONFIGURED" ? 503 : error.code === "FORBIDDEN" ? 403 : 401);
  }
  if (error instanceof StoreError) return json({error:error.safeMessage},error.status);
  return json({ error: "Operacja niedostępna. Spróbuj ponownie." }, 503);
}
export function guardMutation(request: Request): Response | null {
  return policy.trustedMutation(request) ? null : json({ error: "Niedozwolone źródło żądania." }, 403);
}
export function uuid(value: unknown): value is string { return policy.validateUuid(value); }
export async function bodyJson(request: Request, max = 25000): Promise<Record<string,unknown>> {
  if (Number(request.headers.get("content-length") || "0") > max) throw new StoreError(413,"Żądanie jest zbyt duże.");
  const text = await request.text();
  if (text.length > max) throw new StoreError(413,"Żądanie jest zbyt duże.");
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
    return value as Record<string,unknown>;
  } catch {
    throw new StoreError(400,"Nieprawidłowy JSON.");
  }
}
