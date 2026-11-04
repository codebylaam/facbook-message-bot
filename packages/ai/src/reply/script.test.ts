import { describe, expect, test } from "bun:test";
import { replyMatchesScript, resolveLanguage } from "./script.ts";

describe("resolveLanguage", () => {
  test("a message with Bangla letters is Bangla whatever the model said", () => {
    expect(resolveLanguage("ডেলিভারি চার্জ কত?", "en")).toBe("bn");
  });

  test("a Latin message is never Bangla, even when the model says so", () => {
    expect(resolveLanguage("What are your delivery charges?", "bn")).toBe("en");
    expect(resolveLanguage("delivery charge koto?", "bn")).toBe("banglish");
  });

  test("the model's Banglish or English label is kept for a Latin message", () => {
    expect(resolveLanguage("price?", "banglish")).toBe("banglish");
    expect(resolveLanguage("dam koto", "en")).toBe("en");
  });
});

describe("replyMatchesScript", () => {
  test("an English reply with Bangla words or digits is mixed", () => {
    expect(replyMatchesScript("Delivery is ৬০ টাকা inside Dhaka.", "en")).toBe(false);
    expect(replyMatchesScript("Delivery is ৬০ taka.", "en")).toBe(false);
    expect(replyMatchesScript("Delivery takes ২ থেকে ৪ days.", "banglish")).toBe(false);
  });

  test("the taka sign alone does not make a reply Bangla", () => {
    expect(replyMatchesScript("Delivery is ৳60 inside Dhaka.", "en")).toBe(true);
  });

  test("a Bangla reply may name a product in English", () => {
    expect(replyMatchesScript("Cotton Shirt এর দাম ১২০০ টাকা।", "bn")).toBe(true);
  });
});
