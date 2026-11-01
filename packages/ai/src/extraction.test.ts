import { describe, expect, test } from "bun:test";
import {
  ExtractionError,
  extractionResultSchema,
  extractProducts,
  parseJsonContent,
} from "./extraction.ts";
import type { ChatResult, LlmClient } from "./llm-types.ts";

function stubLlm(content: string): LlmClient {
  return {
    chat: async (): Promise<ChatResult> => ({ content, model: "test", usage: {} }),
  };
}

const POST = { message: "নতুন কটন শার্ট, দাম ১২০০ টাকা", imageCount: 2, createdTime: null };

describe("parseJsonContent", () => {
  test("parses plain json", () => {
    expect(parseJsonContent('{"a":1}')).toEqual({ a: 1 });
  });

  test("strips a json code fence", () => {
    expect(parseJsonContent('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  test("strips a bare code fence", () => {
    expect(parseJsonContent('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});

describe("extractProducts", () => {
  test("returns the extracted products", async () => {
    const llm = stubLlm(
      JSON.stringify({
        products: [
          {
            name: "Cotton Shirt",
            description: "Full sleeve",
            price: 1200,
            salePrice: 999,
            stockStatus: "in_stock",
            sizes: ["L", "XL"],
            colors: ["blue"],
            confidence: 0.9,
          },
        ],
      }),
    );

    const products = await extractProducts(llm, POST);

    expect(products).toHaveLength(1);
    expect(products[0]?.name).toBe("Cotton Shirt");
    expect(products[0]?.price).toBe(1200);
    expect(products[0]?.salePrice).toBe(999);
    expect(products[0]?.sizes).toEqual(["L", "XL"]);
    expect(products[0]?.confidence).toBe(0.9);
  });

  test("returns nothing for a post that is not selling", async () => {
    const products = await extractProducts(stubLlm('{"products":[]}'), {
      message: "আজ দোকান বন্ধ",
      imageCount: 0,
      createdTime: null,
    });

    expect(products).toEqual([]);
  });

  test("coerces a price written as text", async () => {
    const products = await extractProducts(
      stubLlm('{"products":[{"name":"Pant","price":"1,250 taka"}]}'),
      POST,
    );

    expect(products[0]?.price).toBe(1250);
  });

  test("coerces a single size string into a list", async () => {
    const products = await extractProducts(
      stubLlm('{"products":[{"name":"Pant","sizes":"L, XL, XXL"}]}'),
      POST,
    );

    expect(products[0]?.sizes).toEqual(["L", "XL", "XXL"]);
  });

  test("fills in defaults for fields the model omitted", async () => {
    const products = await extractProducts(stubLlm('{"products":[{"name":"Pant"}]}'), POST);

    expect(products[0]?.price).toBeNull();
    expect(products[0]?.currency).toBe("BDT");
    expect(products[0]?.stockStatus).toBe("unknown");
    expect(products[0]?.sizes).toEqual([]);
    expect(products[0]?.colors).toEqual([]);
  });

  test("keeps a null price as null rather than zero", async () => {
    const products = await extractProducts(
      stubLlm('{"products":[{"name":"Pant","price":null}]}'),
      POST,
    );

    expect(products[0]?.price).toBeNull();
  });

  test("falls back to unknown for an unrecognised stock status", async () => {
    const products = await extractProducts(
      stubLlm('{"products":[{"name":"Pant","stockStatus":"plenty"}]}'),
      POST,
    );

    expect(products[0]?.stockStatus).toBe("unknown");
  });

  test("throws when the model does not return json", async () => {
    await expect(extractProducts(stubLlm("I could not find a product"), POST)).rejects.toThrow(
      ExtractionError,
    );
  });

  test("drops a product that has no name but keeps the valid ones", async () => {
    const products = await extractProducts(
      stubLlm('{"products":[{"price":10},{"name":"Shirt"}]}'),
      POST,
    );

    expect(products).toHaveLength(1);
    expect(products[0]?.name).toBe("Shirt");
  });

  test("throws when no product at all matches the shape", async () => {
    const error = await extractProducts(stubLlm('{"products":[{"price":10}]}'), POST).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(ExtractionError);
    expect((error as ExtractionError).message).toContain("matched the expected shape");
  });

  test("accepts a fenced response", async () => {
    const products = await extractProducts(
      stubLlm('```json\n{"products":[{"name":"Shirt"}]}\n```'),
      POST,
    );

    expect(products[0]?.name).toBe("Shirt");
  });
});

describe("extractionResultSchema", () => {
  test("turns a missing products array into an empty list", () => {
    expect(extractionResultSchema.parse({}).products).toEqual([]);
  });

  test("rejects a products field that is not an array", () => {
    expect(() => extractionResultSchema.parse({ products: "none" })).toThrow();
  });

  test("throws when the model returns a products field that is not an array", async () => {
    await expect(extractProducts(stubLlm('{"products":"none"}'), POST)).rejects.toThrow(
      ExtractionError,
    );
  });
});
