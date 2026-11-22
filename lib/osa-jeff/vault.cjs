"use strict";
const {createCipheriv, createDecipheriv, randomBytes} = require("node:crypto");
function masterKey(env = process.env) {
  const input = env.OSA_JEFF_MASTER_KEY;
  if (!input || !/^[A-Za-z0-9+/]{43}=$/.test(input)) throw new Error("VAULT_NOT_CONFIGURED");
  const key = Buffer.from(input, "base64");
  if (key.length !== 32) throw new Error("VAULT_INVALID_KEY");
  return key;
}
function encrypt(plaintext, userId, provider, env = process.env) {
  if (typeof plaintext !== "string" || plaintext.length < 8 || plaintext.length > 8192) throw Error("VAULT_INVALID_INPUT");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", masterKey(env), iv);
  cipher.setAAD(Buffer.from(userId + ":" + provider));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}
function decrypt(envelope, userId, provider, env = process.env) {
  const parts = String(envelope).split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw Error("VAULT_INVALID_ENVELOPE");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(env), Buffer.from(parts[1], "base64url"));
  decipher.setAAD(Buffer.from(userId + ":" + provider));
  decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
}
module.exports = { encrypt, decrypt, masterKey };
