import { describe, expect, test } from "bun:test";
import { isValidMetaAppId, parseOrigins } from "./env.ts";

describe("parseOrigins", () => {
  test("takes a single origin", () => {
    expect(parseOrigins("https://bot.example.com")).toEqual(["https://bot.example.com"]);
  });

  test("splits a list, which is how dev allows both http and https", () => {
    expect(parseOrigins("https://localhost:5173,http://localhost:5173")).toEqual([
      "https://localhost:5173",
      "http://localhost:5173",
    ]);
  });

  test("trims and drops empty entries", () => {
    expect(parseOrigins(" https://a.example.com , , http://b.example.com ")).toEqual([
      "https://a.example.com",
      "http://b.example.com",
    ]);
  });

  test("returns nothing rather than a blank origin, so CORS allows nobody", () => {
    expect(parseOrigins("")).toEqual([]);
    expect(parseOrigins(" , ")).toEqual([]);
  });
});

describe("isValidMetaAppId", () => {
  test("accepts the numeric id from the app's Basic settings", () => {
    expect(isValidMetaAppId("1445598854307084")).toBe(true);
  });

  test("accepts the longer hex id newer apps use", () => {
    expect(isValidMetaAppId("1a2b3c4d5e6f7a8b9c0d1")).toBe(true);
  });

  test("rejects a placeholder, which FB.init drops in silence", () => {
    expect(isValidMetaAppId("local-app-id")).toBe(false);
  });

  test("rejects empty, blank and non-numeric values", () => {
    expect(isValidMetaAppId("")).toBe(false);
    expect(isValidMetaAppId(" ")).toBe(false);
    expect(isValidMetaAppId("app-1")).toBe(false);
  });
});
