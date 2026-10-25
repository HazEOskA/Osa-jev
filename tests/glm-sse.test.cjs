const {test}=require("node:test");
const assert=require("node:assert/strict");
const {readGlmSse}=require("../components/agent-chat/services/glm-sse.cjs");
function stream(chunks){return new ReadableStream({start(c){for(const x of chunks)c.enqueue(new TextEncoder().encode(x));c.close();}})}
const f=s=>`data: ${JSON.stringify({choices:[{delta:{content:s}}]})}\n\n`;
test("fragmentacja SSE na pojedyncze znaki",async()=>{const out=[];for await(const x of readGlmSse(stream([...(f("Witaj ")+f("świecie")+"data: [DONE]\n\n")]),new AbortController().signal))out.push(x);assert.deepEqual(out,["Witaj ","świecie"]);});
test("wiele deltas w jednej paczce",async()=>{const out=[];for await(const x of readGlmSse(stream([f("a")+f("b")+"data: [DONE]\n\n"]),new AbortController().signal))out.push(x);assert.deepEqual(out,["a","b"]);});
test("brak DONE jest błędem",async()=>{await assert.rejects(async()=>{for await(const x of readGlmSse(stream([f("fragment")]),new AbortController().signal)){}},/brak \[DONE\]/);});
test("SSE error jest błędem",async()=>{await assert.rejects(async()=>{for await(const x of readGlmSse(stream(['data: {"error":{"message":"fail"}}\n\n']),new AbortController().signal)){}},/Błąd dostawcy/);});
test("pusty stream nie jest sukcesem",async()=>{await assert.rejects(async()=>{for await(const x of readGlmSse(stream([]),new AbortController().signal)){}},/brak \[DONE\]/);});
test("CRLF fragmentowane między paczkami",async()=>{const raw=f("Witaj").replaceAll("\n","\r\n")+"data: [DONE]\r\n\r\n";const cut=raw.indexOf("\r\n")+1,out=[];for await(const x of readGlmSse(stream([raw.slice(0,cut),raw.slice(cut)]),new AbortController().signal))out.push(x);assert.deepEqual(out,["Witaj"]);});
