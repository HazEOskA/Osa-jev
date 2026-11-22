"use strict";
const crypto = require("node:crypto");
const COOKIE = "__Host-osa_jeff";
const TTL_SECONDS = 30 * 24 * 60 * 60;
function createSession(secret, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 16) throw Error("ACCESS_NOT_CONFIGURED");
  const payload = Buffer.from(JSON.stringify({version:1, exp:now + TTL_SECONDS * 1000, nonce:crypto.randomBytes(16).toString("base64url")})).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return payload + "." + signature;
}
function verifySession(value, secret, now = Date.now()) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{30,320}\.[a-zA-Z0-9_-]{43}$/.test(value)) return false;
  if (typeof secret !== "string" || secret.length < 16) return false;
  const [payload, signature] = value.split(".");
  const actual = Buffer.from(signature,"base64url");
  if (actual.toString("base64url") !== signature) return false; // Reject noncanonical signature encodings.
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual,expected)) return false;
  try {
    const body = JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    return body.version === 1 && typeof body.nonce === "string" && body.nonce.length >= 16 &&
      Number.isSafeInteger(body.exp) && body.exp > now && body.exp <= now + TTL_SECONDS * 1000;
  } catch {return false;}
}
function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin) return origin === new URL(request.url).origin;
  return request.headers.get("sec-fetch-site") === "same-origin";
}
module.exports = {COOKIE,TTL_SECONDS,createSession,verifySession,sameOrigin};
