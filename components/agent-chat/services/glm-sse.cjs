"use strict";
async function* readGlmSse(body, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let complete = false;
  try {
    while (!complete) {
      if (signal.aborted) throw new DOMException("Strumień przerwany", "AbortError");
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      pending = pending.replace(/\r\n/g, "\n");
      let boundary;
      while ((boundary = pending.indexOf("\n\n")) !== -1) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const data = frame.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        if (data.trim() === "[DONE]") { complete = true; break; }
        let event;
        try { event = JSON.parse(data); } catch { throw new Error("Nieprawidłowy format zdarzenia SSE"); }
        if (event.error) throw new Error("Błąd dostawcy GLM w strumieniu SSE");
        const content = event.choices?.[0]?.delta?.content;
        if (typeof content === "string" && content.length) yield content;
      }
      if (done) break;
      if (pending.length > 131072) throw new Error("Przekroczono limit pojedynczego zdarzenia SSE");
    }
    if (!complete) throw new Error("Niekompletny strumień GLM: brak [DONE]");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
module.exports = { readGlmSse };
