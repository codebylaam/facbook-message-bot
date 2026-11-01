import type { ChatUsage } from "../llm-types.ts";
import type { RetrievedChunk } from "../retrieval.ts";

export type { RetrievedChunk };

export const INTENTS = [
  "pricing",
  "product",
  "stock",
  "delivery",
  "order",
  "complaint",
  "greeting",
  "other",
] as const;

export type Intent = (typeof INTENTS)[number];

export const LANGUAGES = ["bn", "banglish", "en"] as const;

export type CustomerLanguage = (typeof LANGUAGES)[number];

export type Persona = {
  name?: string;
  tone?: string;
  sampleReplies?: string[];
};

export type ReplyKnowledge = {
  pageName: string;
  persona?: Persona | null;
  profileLines: string[];
  policies: { title: string; content: string }[];
};

export type ReplyTurn = {
  role: "customer" | "bot" | "human";
  text: string;
};

export type LeadItem = {
  name: string;
  quantity: number | null;
  variant: string | null;
};

export type LeadDraft = {
  name: string | null;
  phone: string | null;
  address: string | null;
  items: LeadItem[];
};

export type ReplyOutput = {
  reply: string;
  confidence: number;
  needsHuman: boolean;
  handoffReason: string | null;
  intent: Intent;
  sourceIds: string[];
  lead: LeadDraft | null;
};

export type QueryRewrite = {
  query: string;
  intent: Intent;
  language: CustomerLanguage;
};

export type ReplyDecision =
  | { action: "send"; reply: string }
  | { action: "handoff"; reason: string; draft: string };

export type ReplyEngineResult = {
  rewrite: QueryRewrite;
  retrieved: RetrievedChunk[];
  output: ReplyOutput | null;
  decision: ReplyDecision;
  generationError: string | null;
  usage: ChatUsage;
};

export type Retrieve = (query: string) => Promise<RetrievedChunk[]>;
