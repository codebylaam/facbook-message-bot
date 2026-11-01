import { describe, expect, test } from "bun:test";
import { chunkText } from "./chunking.ts";

describe("chunkText", () => {
  test("returns nothing for blank input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  test("keeps a short text as one chunk", () => {
    expect(chunkText("Dhaka delivery is 60 taka.")).toEqual(["Dhaka delivery is 60 taka."]);
  });

  test("collapses whitespace", () => {
    expect(chunkText("a\n\n  b\t c")).toEqual(["a b c"]);
  });

  test("splits a long text into several chunks", () => {
    const sentence = "This shop sells cotton shirts in many sizes. ";
    const chunks = chunkText(sentence.repeat(60), { maxChars: 400, overlapChars: 80 });

    expect(chunks.length).toBeGreaterThan(1);
  });

  test("never exceeds maxChars", () => {
    const text = Array.from(
      { length: 120 },
      (_, index) => `Sentence number ${index} about shirts.`,
    ).join(" ");
    const chunks = chunkText(text, { maxChars: 300, overlapChars: 60 });

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(300);
    }
  });

  test("overlaps consecutive chunks", () => {
    const text = Array.from(
      { length: 60 },
      (_, index) => `Point ${index} about delivery charges.`,
    ).join(" ");
    const chunks = chunkText(text, { maxChars: 300, overlapChars: 100 });

    expect(chunks.length).toBeGreaterThan(1);

    const firstChunkTail = chunks[0]?.slice(-60) ?? "";
    const lastWord = firstChunkTail.split(" ").slice(-4).join(" ");

    expect(chunks[1]).toContain(lastWord);
  });

  test("hard splits a single sentence longer than maxChars", () => {
    const chunks = chunkText("x".repeat(1000), { maxChars: 300, overlapChars: 50 });

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(300);
    }
  });

  test("splits on a Bangla danda", () => {
    const text = "শার্টের দাম ৫০০ টাকা। ডেলিভারি চার্জ ৬০ টাকা। সাইজ এল আছে।";

    expect(chunkText(text, { maxChars: 30, overlapChars: 5 }).length).toBeGreaterThan(1);
  });

  test("keeps every character of a text that splits cleanly", () => {
    const text = "First sentence here. Second sentence here. Third sentence here.";

    expect(chunkText(text, { maxChars: 30, overlapChars: 5 }).join(" ")).toContain(
      "Third sentence here.",
    );
  });

  test("rejects a non positive maxChars", () => {
    expect(() => chunkText("hello", { maxChars: 0 })).toThrow(/greater than zero/);
  });

  test("rejects an overlap that is not smaller than maxChars", () => {
    expect(() => chunkText("hello", { maxChars: 100, overlapChars: 100 })).toThrow(/smaller/);
    expect(() => chunkText("hello", { maxChars: 100, overlapChars: -1 })).toThrow(/at least zero/);
  });
});
