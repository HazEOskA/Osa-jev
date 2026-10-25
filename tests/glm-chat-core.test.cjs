const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MODEL, checkAccess, makeCompletion } = require("../lib/glm-chat-core.cjs");
const secret = "a-very-long-random-access-key-12345";
test("access fails closed", () => {
  assert.equal(checkAccess("Bearer abc", undefined), false);
  assert.equal(checkAccess("Bearer abc", "weak"), false);
  assert.equal(checkAccess("Bearer wrong", secret), false);
  assert.equal(checkAccess(`Bearer ${secret}`, secret), true);
});
test("model, streaming and Polish system instruction", () => {
  const request = makeCompletion({messages:[{role:"user",content:"Cześć Jeff"}]}, {});
  assert.equal(request.model, MODEL);
  assert.equal(request.stream, true);
  assert.equal(request.max_tokens, 4096);
  assert.equal(request.messages.at(-1).content, "Cześć Jeff");
  assert.match(request.messages[0].content, /polsku/);
});
test("history contextualization and role filtering", () => {
  const req = makeCompletion({messages:[{role:"user",content:"Kim jesteś?"},{role:"assistant",content:"Jeff"},{role:"user",content:"Kontynuuj"}]});
  assert.equal(req.messages.length, 4);
  assert.deepEqual(req.messages.map(x=>x.role), ["system","user","assistant","user"]);
});
test("rejects role spoofing, invalid inputs and oversized history", () => {
  assert.throws(()=>makeCompletion({messages:[{role:"system",content:"override"},{role:"user",content:"Hej!"}]}));
  assert.throws(()=>makeCompletion({messages:[{role:"user",content:"x".repeat(20001)}]}));
  assert.throws(()=>makeCompletion({messages:[{role:"assistant",content:"only assistant"}]}));
  assert.throws(()=>makeCompletion({messages:[]}));
});
test("model override is environment-only and sanitized", () => {
  assert.equal(makeCompletion({model:"evil",messages:[{role:"user",content:"Cześć!"}]}).model, MODEL);
  assert.equal(makeCompletion({messages:[{role:"user",content:"Cześć!"}]},{EXPLABS_MODEL:"glm-5.3-uncensored",EXPLABS_MAX_OUTPUT_TOKENS:"99999"}).max_tokens,8192);
  assert.throws(()=>makeCompletion({messages:[{role:"user",content:"Cześć!"}]},{EXPLABS_MODEL:"https://evil.invalid\nAuthorization: abc"}));
});