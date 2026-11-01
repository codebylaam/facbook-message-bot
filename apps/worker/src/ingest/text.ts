import type { ProductVariants } from "@fb-bot/db";

export function productSearchText(product: {
  name: string;
  description: string | null;
  price: string | number | null;
  salePrice: string | number | null;
  currency: string;
  stockStatus: string;
  variants: ProductVariants | null;
}): string {
  const parts = [product.name];

  if (product.description) {
    parts.push(product.description);
  }

  if (product.price !== null) {
    parts.push(`Price: ${product.price} ${product.currency}`);
  }

  if (product.salePrice !== null) {
    parts.push(`Sale price: ${product.salePrice} ${product.currency}`);
  }

  const sizes = product.variants?.sizes ?? [];

  if (sizes.length > 0) {
    parts.push(`Sizes: ${sizes.join(", ")}`);
  }

  const colors = product.variants?.colors ?? [];

  if (colors.length > 0) {
    parts.push(`Colors: ${colors.join(", ")}`);
  }

  if (product.stockStatus !== "unknown") {
    parts.push(`Stock: ${product.stockStatus.replace(/_/g, " ")}`);
  }

  return parts.join(". ");
}

export function faqSearchText(faq: { question: string; answer: string }): string {
  return `${faq.question}\n${faq.answer}`;
}

export function policySearchText(policy: { title: string; content: string }): string {
  return `${policy.title}\n${policy.content}`;
}
