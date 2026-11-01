import { z } from "zod";
import type { LlmClient } from "./llm-types.ts";
import { buildProductExtractionMessages } from "./prompts.ts";

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

const nullableNumber = z.union([z.number(), z.string(), z.null()]).transform((value) => {
  if (value === null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);

  return cleaned.length > 0 && Number.isFinite(parsed) ? parsed : null;
});

const stringList = z.union([z.array(z.string()), z.string(), z.null()]).transform((value) => {
  if (value === null) {
    return [];
  }

  if (typeof value === "string") {
    return value
      .split(/[,/|]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return value.map((item) => item.trim()).filter((item) => item.length > 0);
});

export const extractedProductSchema = z.object({
  name: z.string().min(1),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  price: nullableNumber.optional().transform((value) => value ?? null),
  salePrice: nullableNumber.optional().transform((value) => value ?? null),
  currency: z.string().min(1).default("BDT"),
  stockStatus: z.enum(["in_stock", "out_of_stock", "preorder", "unknown"]).catch("unknown"),
  sizes: stringList.optional().transform((value) => value ?? []),
  colors: stringList.optional().transform((value) => value ?? []),
  confidence: z.number().min(0).max(1).catch(0.5),
});

export const extractionResultSchema = z.object({
  products: z.array(z.unknown()).default([]),
});

export type ExtractedProduct = z.infer<typeof extractedProductSchema>;

export function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);

  return JSON.parse(fenced?.[1] ?? trimmed);
}

export async function extractProducts(
  llm: LlmClient,
  post: { message: string | null; imageCount: number; createdTime: string | null },
): Promise<ExtractedProduct[]> {
  const completion = await llm.chat(buildProductExtractionMessages(post), {
    json: true,
    temperature: 0,
  });

  let parsed: unknown;

  try {
    parsed = parseJsonContent(completion.content);
  } catch {
    throw new ExtractionError("The model did not return valid JSON");
  }

  const validated = extractionResultSchema.safeParse(parsed);

  if (!validated.success) {
    throw new ExtractionError(
      `The model returned an unexpected shape: ${validated.error.issues[0]?.message ?? "unknown"}`,
    );
  }

  const products: ExtractedProduct[] = [];
  let rejected = 0;

  for (const item of validated.data.products) {
    const product = extractedProductSchema.safeParse(item);

    if (product.success) {
      products.push(product.data);
    } else {
      rejected += 1;
    }
  }

  if (validated.data.products.length > 0 && products.length === 0) {
    throw new ExtractionError(
      `None of the ${validated.data.products.length} extracted products matched the expected shape`,
    );
  }

  if (rejected > 0) {
    console.warn(`[ai] dropped ${rejected} extracted product(s) that did not match the shape`);
  }

  return products;
}
