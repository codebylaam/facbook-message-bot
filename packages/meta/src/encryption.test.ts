import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { decryptToken, encryptToken, parseEncryptionKey, redactToken } from "./encryption.ts";

const KEY = randomBytes(32);

describe("parseEncryptionKey", () => {
  test("accepts a 64 character hex key", () => {
    const hex = randomBytes(32).toString("hex");

    expect(parseEncryptionKey(hex)).toHaveLength(32);
  });

  test("accepts a base64 key", () => {
    const base64 = randomBytes(32).toString("base64");

    expect(parseEncryptionKey(base64)).toHaveLength(32);
  });

  test("rejects an empty key", () => {
    expect(() => parseEncryptionKey("   ")).toThrow(/empty/);
  });

  test("rejects a key of the wrong length", () => {
    expect(() => parseEncryptionKey(randomBytes(16).toString("hex"))).toThrow(/32 bytes/);
  });
});

describe("token encryption", () => {
  test("round-trips a token", () => {
    const token = "EAAG-page-access-token-abcdefghijklmnop";

    expect(decryptToken(encryptToken(token, KEY), KEY)).toBe(token);
  });

  test("produces a different ciphertext each time", () => {
    const token = "EAAG-page-access-token";

    expect(encryptToken(token, KEY)).not.toBe(encryptToken(token, KEY));
  });

  test("does not leak the plaintext", () => {
    const token = "EAAG-super-secret-value";

    expect(encryptToken(token, KEY)).not.toContain("secret");
  });

  test("stores the iv, tag and ciphertext as three parts", () => {
    expect(encryptToken("token", KEY).split(".")).toHaveLength(3);
  });

  test("rejects a tampered ciphertext", () => {
    const encrypted = encryptToken("EAAG-token", KEY);
    const [iv, tag, data] = encrypted.split(".");
    const tampered = Buffer.from(data ?? "", "base64url");
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;

    const forged = [iv, tag, tampered.toString("base64url")].join(".");

    expect(() => decryptToken(forged, KEY)).toThrow();
  });

  test("rejects a different key", () => {
    const encrypted = encryptToken("EAAG-token", KEY);

    expect(() => decryptToken(encrypted, randomBytes(32))).toThrow();
  });

  test("rejects a malformed payload", () => {
    expect(() => decryptToken("not-a-payload", KEY)).toThrow(/malformed/);
  });

  test("rejects a key that is not 32 bytes when encrypting", () => {
    expect(() => encryptToken("token", randomBytes(16))).toThrow(/32 bytes/);
  });
});

describe("redactToken", () => {
  test("keeps a short prefix and hides the rest", () => {
    const redacted = redactToken("EAAG-page-access-token");

    expect(redacted).toStartWith("EAAG");
    expect(redacted).not.toContain("access");
  });

  test("hides short tokens entirely", () => {
    expect(redactToken("short")).toBe("***");
  });
});
