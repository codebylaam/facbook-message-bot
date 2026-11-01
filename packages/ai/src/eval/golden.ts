import type { CustomerLanguage } from "../reply/types.ts";
import type { RetrievedChunk } from "../retrieval.ts";

export type CatalogEntry = {
  id: string;
  sourceType: "product" | "faq" | "policy";
  content: string;
};

/**
 * The shop every golden question is asked against. The eval hands the whole
 * catalog to the model as context, so retrieval quality is not what is measured
 * here; the reply engine's facts, honesty and handoff behaviour are.
 */
export const GOLDEN_CATALOG: CatalogEntry[] = [
  {
    id: "product-shirt",
    sourceType: "product",
    content:
      "Cotton Shirt. Full sleeve cotton shirt. Price: 1200.00 BDT. Sizes: L, XL. Colors: blue, black. Stock: in stock",
  },
  {
    id: "product-denim-pant",
    sourceType: "product",
    content:
      "Denim Pant. Slim fit denim. Price: 1800.00 BDT. Sizes: 30, 32, 34. Colors: blue, black. Stock: in stock",
  },
  {
    id: "product-panjabi",
    sourceType: "product",
    content:
      "Panjabi. Eid collection panjabi. Price: 2500.00 BDT. Sizes: M, L, XL. Colors: white, off white. Stock: in stock",
  },
  {
    id: "product-three-piece",
    sourceType: "product",
    content:
      "Three Piece. Unstitched three piece. Price: 3200.00 BDT. Sizes: M, L. Colors: red, green. Stock: out of stock",
  },
  {
    id: "product-hoodie",
    sourceType: "product",
    content:
      "Hoodie. Winter hoodie. Price: 1500.00 BDT. Sale price: 1200.00 BDT. Sizes: M, L, XL. Colors: grey, black. Stock: in stock",
  },
  {
    id: "faq-delivery-inside",
    sourceType: "faq",
    content: "ঢাকার ভিতরে ডেলিভারি চার্জ কত? ঢাকার ভিতরে ডেলিভারি চার্জ ৬০ টাকা।",
  },
  {
    id: "faq-delivery-outside",
    sourceType: "faq",
    content: "ঢাকার বাইরে ডেলিভারি চার্জ কত? ঢাকার বাইরে ডেলিভারি চার্জ ১২০ টাকা।",
  },
  {
    id: "faq-cod",
    sourceType: "faq",
    content: "ক্যাশ অন ডেলিভারি আছে? হ্যাঁ, ক্যাশ অন ডেলিভারি সুবিধা আছে।",
  },
  {
    id: "faq-return",
    sourceType: "faq",
    content: "রিটার্ন পলিসি কি? পণ্য পাওয়ার ৭ দিনের মধ্যে রিটার্ন করা যাবে।",
  },
  {
    id: "policy-delivery",
    sourceType: "policy",
    content:
      "Delivery: ঢাকার ভিতরে ডেলিভারি চার্জ ৬০ টাকা, ঢাকার বাইরে ১২০ টাকা। ডেলিভারি ২ থেকে ৪ দিনের মধ্যে পৌঁছায়।",
  },
  {
    id: "policy-returns",
    sourceType: "policy",
    content: "Returns: পণ্য পাওয়ার ৭ দিনের মধ্যে রিটার্ন করা যাবে। ট্যাগ এবং প্যাকেজিং অক্ষত থাকতে হবে।",
  },
  {
    id: "policy-payment",
    sourceType: "policy",
    content: "Payment: ক্যাশ অন ডেলিভারি, বিকাশ এবং নগদ গ্রহণ করা হয়।",
  },
];

export function catalogChunks(entries: CatalogEntry[] = GOLDEN_CATALOG): RetrievedChunk[] {
  return entries.map((entry, index) => ({
    id: entry.id,
    content: entry.content,
    sourceType: entry.sourceType,
    sourceId: null,
    score: 1 / (index + 1),
    vectorRank: null,
    textRank: index + 1,
    trigramRank: null,
  }));
}

export function catalogText(entries: CatalogEntry[] = GOLDEN_CATALOG): string {
  return entries.map((entry) => entry.content).join("\n");
}

export type GoldenCase = {
  id: string;
  language: CustomerLanguage;
  question: string;
  expects: {
    handoff: boolean;
    facts?: string[];
    forbidden?: string[];
  };
};

const mustHandoff = { handoff: true };

export const GOLDEN_CASES: GoldenCase[] = [
  // Prices, asked three ways.
  {
    id: "bn-price-shirt",
    language: "bn",
    question: "এই শার্টের দাম কত?",
    expects: { handoff: false, facts: ["1200"] },
  },
  {
    id: "bn-price-denim",
    language: "bn",
    question: "ডেনিম প্যান্টের দাম কত?",
    expects: { handoff: false, facts: ["1800"] },
  },
  {
    id: "bn-price-panjabi",
    language: "bn",
    question: "পাঞ্জাবির দাম কত?",
    expects: { handoff: false, facts: ["2500"] },
  },
  {
    id: "bn-price-three-piece",
    language: "bn",
    question: "থ্রি পিসের দাম কত?",
    expects: { handoff: false, facts: ["3200"] },
  },
  {
    id: "bn-price-hoodie",
    language: "bn",
    question: "হুডির দাম কত?",
    expects: { handoff: false, facts: ["1500"] },
  },

  {
    id: "banglish-price-shirt",
    language: "banglish",
    question: "ei shirt er dam koto?",
    expects: { handoff: false, facts: ["1200"] },
  },
  {
    id: "banglish-price-pant",
    language: "banglish",
    question: "denim pant er daam koto?",
    expects: { handoff: false, facts: ["1800"] },
  },
  {
    id: "banglish-price-panjabi",
    language: "banglish",
    question: "panjabi er price koto?",
    expects: { handoff: false, facts: ["2500"] },
  },
  {
    id: "banglish-price-hoodie",
    language: "banglish",
    question: "hoodie koto taka?",
    expects: { handoff: false, facts: ["1500"] },
  },
  {
    id: "banglish-price-shirt-size",
    language: "banglish",
    question: "shirt er dam koto, L size ache?",
    expects: { handoff: false, facts: ["1200"] },
  },

  {
    id: "en-price-shirt",
    language: "en",
    question: "How much is the cotton shirt?",
    expects: { handoff: false, facts: ["1200"] },
  },
  {
    id: "en-price-denim",
    language: "en",
    question: "What is the price of the denim pant?",
    expects: { handoff: false, facts: ["1800"] },
  },
  {
    id: "en-price-panjabi",
    language: "en",
    question: "Price of the panjabi please",
    expects: { handoff: false, facts: ["2500"] },
  },
  {
    id: "en-price-three-piece",
    language: "en",
    question: "How much for the three piece?",
    expects: { handoff: false, facts: ["3200"] },
  },
  {
    id: "en-sale-price-hoodie",
    language: "en",
    question: "Is the hoodie on sale?",
    expects: { handoff: false, facts: ["1200"] },
  },

  // Delivery.
  {
    id: "bn-delivery-inside",
    language: "bn",
    question: "ঢাকার ভিতরে ডেলিভারি চার্জ কত?",
    expects: { handoff: false, facts: ["60"] },
  },
  {
    id: "bn-delivery-outside",
    language: "bn",
    question: "ঢাকার বাইরে ডেলিভারি চার্জ কত?",
    expects: { handoff: false, facts: ["120"] },
  },
  {
    id: "banglish-delivery-inside",
    language: "banglish",
    question: "dhaka er vitore delivery charge koto?",
    expects: { handoff: false, facts: ["60"] },
  },
  {
    id: "banglish-delivery-outside",
    language: "banglish",
    question: "dhaka er baire delivery koto lagbe?",
    expects: { handoff: false, facts: ["120"] },
  },
  {
    id: "en-delivery-inside",
    language: "en",
    question: "What is the delivery charge inside Dhaka?",
    expects: { handoff: false, facts: ["60"] },
  },
  {
    id: "en-delivery-outside",
    language: "en",
    question: "How much is delivery outside Dhaka?",
    expects: { handoff: false, facts: ["120"] },
  },
  {
    id: "bn-delivery-charge-combined",
    language: "bn",
    question: "ডেলিভারি চার্জ কত?",
    expects: { handoff: false, facts: ["60", "120"] },
  },
  {
    id: "en-delivery-charge-combined",
    language: "en",
    question: "What are your delivery charges?",
    expects: { handoff: false, facts: ["60", "120"] },
  },

  // Returns and payment.
  {
    id: "bn-return-window",
    language: "bn",
    question: "রিটার্ন পলিসি কি?",
    expects: { handoff: false, facts: ["7"] },
  },
  {
    id: "bn-return-days",
    language: "bn",
    question: "কত দিনের মধ্যে রিটার্ন করা যাবে?",
    expects: { handoff: false, facts: ["7"] },
  },
  {
    id: "banglish-return",
    language: "banglish",
    question: "return policy ki? koto din?",
    expects: { handoff: false, facts: ["7"] },
  },
  {
    id: "en-return",
    language: "en",
    question: "What is your return policy?",
    expects: { handoff: false, facts: ["7"] },
  },
  {
    id: "en-return-window",
    language: "en",
    question: "How many days do I have to return an item?",
    expects: { handoff: false, facts: ["7"] },
  },
  { id: "bn-cod", language: "bn", question: "ক্যাশ অন ডেলিভারি আছে?", expects: { handoff: false } },
  {
    id: "banglish-cod",
    language: "banglish",
    question: "cash on delivery ache?",
    expects: { handoff: false },
  },
  {
    id: "en-cod",
    language: "en",
    question: "Do you offer cash on delivery?",
    expects: { handoff: false },
  },
  {
    id: "bn-payment-methods",
    language: "bn",
    question: "কি কি মাধ্যমে পেমেন্ট করা যায়?",
    expects: { handoff: false },
  },
  {
    id: "en-payment",
    language: "en",
    question: "Which payment methods do you accept?",
    expects: { handoff: false },
  },

  // Stock and sizes.
  {
    id: "bn-stock-panjabi",
    language: "bn",
    question: "পাঞ্জাবি স্টকে আছে?",
    expects: { handoff: false },
  },
  {
    id: "bn-stock-three-piece",
    language: "bn",
    question: "থ্রি পিস কি স্টকে আছে?",
    expects: { handoff: false },
  },
  {
    id: "banglish-stock-shirt",
    language: "banglish",
    question: "shirt stock e ache?",
    expects: { handoff: false },
  },
  {
    id: "en-stock-hoodie",
    language: "en",
    question: "Is the hoodie in stock?",
    expects: { handoff: false },
  },
  {
    id: "bn-sizes-shirt",
    language: "bn",
    question: "শার্টের কি কি সাইজ আছে?",
    expects: { handoff: false },
  },
  {
    id: "bn-sizes-denim",
    language: "bn",
    question: "ডেনিম প্যান্টের সাইজ কি কি?",
    expects: { handoff: false },
  },
  {
    id: "banglish-sizes",
    language: "banglish",
    question: "shirt er size ki ki ache?",
    expects: { handoff: false },
  },
  {
    id: "en-sizes",
    language: "en",
    question: "What sizes does the panjabi come in?",
    expects: { handoff: false },
  },
  { id: "bn-colors", language: "bn", question: "শার্টের কালার কি কি?", expects: { handoff: false } },

  // Greetings and small talk.
  { id: "bn-greeting", language: "bn", question: "আসসালামু আলাইকুম", expects: { handoff: false } },
  {
    id: "banglish-greeting",
    language: "banglish",
    question: "assalamu alaikum",
    expects: { handoff: false },
  },
  { id: "en-greeting", language: "en", question: "Hi there!", expects: { handoff: false } },

  // Everything below must reach a human.
  {
    id: "en-iphone-unknown-product",
    language: "en",
    question: "Do you sell iPhone 15 cases?",
    expects: mustHandoff,
  },
  { id: "bn-unknown-product", language: "bn", question: "আপনাদের কি জুতা আছে?", expects: mustHandoff },
  {
    id: "banglish-unknown-product",
    language: "banglish",
    question: "juta ache apnader?",
    expects: mustHandoff,
  },
  {
    id: "en-international-shipping",
    language: "en",
    question: "Do you ship to Canada?",
    expects: mustHandoff,
  },
  {
    id: "bn-international-shipping",
    language: "bn",
    question: "আপনারা কানাডায় শিপ করেন?",
    expects: mustHandoff,
  },
  {
    id: "en-bulk-discount",
    language: "en",
    question: "Is there a discount if I buy 100 pieces?",
    expects: mustHandoff,
  },
  {
    id: "bn-bulk-discount",
    language: "bn",
    question: "১০০ পিস নিলে ডিসকাউন্ট আছে?",
    expects: mustHandoff,
  },
  {
    id: "en-custom-order",
    language: "en",
    question: "Can you make a custom design for me?",
    expects: mustHandoff,
  },
  {
    id: "banglish-custom-order",
    language: "banglish",
    question: "custom design banaite parben?",
    expects: mustHandoff,
  },
  { id: "en-emi", language: "en", question: "Do you offer EMI?", expects: mustHandoff },
  { id: "bn-shop-address", language: "bn", question: "আপনাদের দোকান কোথায়?", expects: mustHandoff },
  {
    id: "en-same-day-delivery",
    language: "en",
    question: "Can you deliver tomorrow before 9am?",
    expects: mustHandoff,
  },
  {
    id: "en-warranty",
    language: "en",
    question: "What is the warranty on the shirts?",
    expects: mustHandoff,
  },
  {
    id: "bn-order-confirm",
    language: "bn",
    question: "আমি ২টা শার্ট অর্ডার করতে চাই",
    expects: mustHandoff,
  },
  {
    id: "en-order-with-phone",
    language: "en",
    question: "I want to buy 2 shirts, my number is 01700000000",
    expects: mustHandoff,
  },
  {
    id: "banglish-order",
    language: "banglish",
    question: "ami ekta panjabi nite chai, address Mirpur",
    expects: mustHandoff,
  },
  {
    id: "en-refund-timeline",
    language: "en",
    question: "How long does a refund take to reach my bank?",
    expects: mustHandoff,
  },
  {
    id: "bn-stock-other-color",
    language: "bn",
    question: "শার্টের লাল কালার আছে?",
    expects: mustHandoff,
  },
];
