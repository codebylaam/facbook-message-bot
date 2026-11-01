import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const REDACTED = "***";

export function parseEncryptionKey(raw: string): Buffer {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    throw new Error("TOKEN_ENC_KEY is empty");
  }

  const key = /^[0-9a-fA-F]{64}$/.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");

  if (key.length !== KEY_BYTES) {
    throw new Error(`TOKEN_ENC_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}`);
  }

  return key;
}

export function encryptToken(plaintext: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) {
    throw new Error(`encryption key must be ${KEY_BYTES} bytes`);
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptToken(payload: string, key: Buffer): string {
  const [ivPart, tagPart, dataPart] = payload.split(".");

  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("encrypted token is malformed");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function redactToken(token: string): string {
  if (token.length <= 8) {
    return REDACTED;
  }

  return `${token.slice(0, 4)}…${REDACTED}`;
}
