const { test, after } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
const srcPath = path.join(__dirname, "../app/api/glm-chat/route.ts")
const tempPath = path.join(__dirname, "../app/api/glm-chat/.test-runtime.cjs")
const out = ts.transpileModule(fs.readFileSync(srcPath, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: srcPath,
})
fs.writeFileSync(tempPath, out.outputText)
const { POST, GET } = require(tempPath)
const orig = { fetch: global.fetch, key: process.env.EXPLABS_API_KEY, access: process.env.JEFF_CHAT_ACCESS_TOKEN }
after(() => {
  global.fetch = orig.fetch
  for (const [name, val] of [["EXPLABS_API_KEY", orig.key], ["JEFF_CHAT_ACCESS_TOKEN", orig.access]]) {
    if (val === undefined) delete process.env[name]
    else process.env[name] = val
  }
  try { fs.unlinkSync(tempPath) } catch {}
})
const token = "random-private-token-for-tests-00001"
const url = "http://localhost:3000/api/glm-chat"
const req = (key, messages = [{ role: "user", content: "Hej, Jeff!" }]) => new Request(url, { method: "POST", headers: {
  "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}),
}, body: JSON.stringify({ model: "ignored-client-model", messages }) })
test("no token configured → no upstream call", async () => {
  delete process.env.JEFF_CHAT_ACCESS_TOKEN
  global.fetch = () => { throw Error("unexpected fetch") }
  assert.equal((await POST(req(token))).status, 503)
})
test("wrong token → deny", async () => {
  process.env.JEFF_CHAT_ACCESS_TOKEN = token
  assert.equal((await POST(req("wrong"))).status, 401)
})
test("missing API key → deny", async () => {
  process.env.JEFF_CHAT_ACCESS_TOKEN = token
  delete process.env.EXPLABS_API_KEY
  assert.equal((await POST(req(token))).status, 503)
})
test("valid request → SSE proxy with server-side model selection", async () => {
  process.env.JEFF_CHAT_ACCESS_TOKEN = token
  process.env.EXPLABS_API_KEY = "fake-explabs-test"
  global.fetch = async (endpoint, options) => {
    assert.equal(endpoint, "https://api.experientiallabs.ai/v1/chat/completions")
    assert.equal(options.headers.Authorization, "Bearer fake-explabs-test")
    const payload = JSON.parse(options.body)
    assert.equal(payload.model, "glm-5.3-flash-uncensored")
    assert.equal(payload.stream, true)
    assert.equal(payload.messages.at(-1).content, "Hej, Jeff!")
    return new Response('data: {"choices":[{"delta":{"content":"Cześć"}}]}\n\ndata: [DONE]\n\n', {headers:{"content-type":"text/event-stream"}})
  }
  const res = await POST(req(token))
  assert.equal(res.status, 200)
  assert.match(await res.text(), /Cześć/)
  const health = await GET()
  assert.equal((await health.json()).configured, true)
})
test("provider model 404 produces clean error without leaked secret", async () => {
  global.fetch = async () => new Response('{"error":{"message":"secret error"}}', { status: 404 })
  const res = await POST(req(token))
  assert.equal(res.status, 502)
  const data = await res.json()
  assert.match(data.error, /EXPLABS_MODEL/)
  assert.ok(!JSON.stringify(data).includes("secret"))
})