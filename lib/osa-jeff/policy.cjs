"use strict";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowedEmails(env = process.env) {
  return new Set((env.OSA_JEFF_ALLOWED_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(x => EMAIL_RE.test(x)));
}
function isAllowedGoogleProfile(profile, env = process.env) {
  return Boolean(profile && profile.email_verified === true &&
    typeof profile.sub === "string" && /^[0-9]{6,50}$/.test(profile.sub) &&
    typeof profile.email === "string" &&
    allowedEmails(env).has(profile.email.toLowerCase()));
}
function validateUuid(value) { return typeof value === "string" && UUID_RE.test(value); }
function validModel(value) { return ["glm", "auto", "nvidia", "openrouter"].includes(value); }
function trustedMutation(request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  if (origin) return origin === expected;
  // Missing Origin must be accompanied by an explicit same-origin browser signal.
  return request.headers.get("sec-fetch-site") === "same-origin";
}
function isConfigured(env = process.env) {
  return Boolean(env.AUTH_SECRET?.length >= 32 && env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET && env.DATABASE_URL &&
    allowedEmails(env).size >= 1);
}
module.exports = { allowedEmails, isAllowedGoogleProfile, validateUuid, validModel, trustedMutation, isConfigured };
