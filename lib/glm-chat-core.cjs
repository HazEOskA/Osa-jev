"use strict";
const crypto = require("node:crypto");
const MODEL = "glm-5.3-flash-uncensored";
const MAX_HISTORY = 40;
const MAX_MESSAGE = 20000;
const MAX_TOTAL = 120000;
function checkAccess(header, secret) {
  if (!secret || typeof secret !== "string" || secret.length < 16) return false;
  const supplied = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(supplied, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function makeCompletion(payload, env = process.env) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.messages)) throw new Error("Nieprawidłowa historia rozmowy.");
  if (payload.messages.length < 1 || payload.messages.length > 80) throw new Error("Nieprawidłowa liczba wiadomości.");
  const incoming = payload.messages;
  for (const msg of incoming) {
    if (!msg || typeof msg !== "object" || !["user", "assistant"].includes(msg.role) || typeof msg.content !== "string" || msg.content.length < 1 || msg.content.length > MAX_MESSAGE) {
      throw new Error("Nieprawidłowy format wiadomości.");
    }
  }
  if (incoming.at(-1).role !== "user" || incoming.at(-1).content.trim().length < 2) throw new Error("Ostatnia wiadomość musi pochodzić od użytkownika.");
  const last = incoming.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content }));
  if (last.reduce((sum, m) => sum + m.content.length, 0) > MAX_TOTAL) throw new Error("Historia jest zbyt długa. Rozpocznij nowy czat.");
  const model = env.EXPLABS_MODEL || MODEL;
  if (!/^[a-zA-Z0-9._:/-]{2,100}$/.test(model)) throw new Error("Nieprawidłowy model w konfiguracji serwera.");
  const maxTokens = Math.min(8192, Math.max(512, Number.parseInt(env.EXPLABS_MAX_OUTPUT_TOKENS || "4096", 10) || 4096));
  return {
    model,
    stream: true,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: "Jesteś OSA Jeff, pomocnym asystentem AI. Odpowiadaj domyślnie po polsku, konkretnie, merytorycznie i bez zmyślania faktów. Nie deklaruj dostępu do narzędzi, plików ani pamięci, których nie masz. Nie wykonujesz czynności poza rozmową." },
      ...last,
    ],
  };
}
module.exports = { MODEL, checkAccess, makeCompletion };