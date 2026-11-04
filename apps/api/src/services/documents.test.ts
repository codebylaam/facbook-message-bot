import { describe, expect, test } from "bun:test";
import { DOCUMENT_EXTENSIONS } from "@fb-bot/shared";
import { extensionOf, isAllowedDocument, mimeTypeFor, readDocument } from "./documents.ts";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("readDocument", () => {
  test("accepts a markdown file and keeps its text", () => {
    const result = readDocument("price-list.md", bytes("# Prices\n\nShirt: 1200 BDT"));

    expect(result.mimeType).toBe("text/markdown");
    expect(result.content).toBe("# Prices\n\nShirt: 1200 BDT");
  });

  test("accepts plain text and csv", () => {
    expect(readDocument("delivery.txt", bytes("Inside Dhaka 60")).mimeType).toBe("text/plain");
    expect(readDocument("stock.csv", bytes("name,qty\nshirt,3")).mimeType).toBe("text/csv");
  });

  test("drops a byte order mark, which would otherwise prefix the first chunk", () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes("Delivery is 120 BDT")]);

    expect(readDocument("delivery.md", withBom).content).toBe("Delivery is 120 BDT");
  });

  test("normalises windows line endings and trims", () => {
    expect(readDocument("notes.txt", bytes("  a\r\nb\r\n  ")).content).toBe("a\nb");
  });

  test("rejects a format the picker does not offer, and says what it accepts", () => {
    expect(() => readDocument("catalogue.pdf", bytes("%PDF-1.7"))).toThrow(
      new RegExp(DOCUMENT_EXTENSIONS.join(", ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });

  test("rejects a binary file that was renamed to .txt", () => {
    expect(() => readDocument("scan.txt", new Uint8Array([0x50, 0x00, 0x4b, 0x03]))).toThrow(
      /binary document/,
    );
  });
});

describe("document names", () => {
  test("matches the extension case insensitively", () => {
    expect(extensionOf("Price-List.MD")).toBe(".md");
    expect(isAllowedDocument("Price-List.MD")).toBe(true);
    expect(mimeTypeFor("Price-List.MD")).toBe("text/markdown");
  });

  test("treats a name without an extension as unsupported", () => {
    expect(extensionOf("README")).toBe("");
    expect(isAllowedDocument("README")).toBe(false);
  });
});
