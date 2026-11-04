import { detectLanguage } from "./query-rewrite.ts";
import type { CustomerLanguage } from "./types.ts";

// Bengali letters only. The block also holds digits and the taka sign (U+09F3),
// and an English reply that writes "৳60" is still an English reply.
const BANGLA_LETTER = /[অ-হৎড়-য়ৰ-ৱ]/;
const BANGLA_DIGIT = /[০-৯]/;

export function hasBanglaLetters(text: string): boolean {
  return BANGLA_LETTER.test(text);
}

/**
 * The rewrite model reports the customer's script, but it is also told to write
 * Bangla keywords, and it sometimes labels a plain English message "bn". Bangla
 * script is a fact we can check, so it is never left to the model: a message
 * with Bangla letters is Bangla, and one without them can only be Banglish or
 * English.
 */
export function resolveLanguage(message: string, reported: CustomerLanguage): CustomerLanguage {
  if (hasBanglaLetters(message)) {
    return "bn";
  }

  return reported === "bn" ? detectLanguage(message) : reported;
}

/**
 * A Latin-script customer must get a Latin-script reply. Bangla letters or
 * Bangla digits ("৬০ টাকা") in it mean the model slipped into Bangla. A Bangla
 * reply may still name a product in English, so it is not checked.
 */
export function replyMatchesScript(reply: string, language: CustomerLanguage): boolean {
  if (language === "bn") {
    return true;
  }

  return !hasBanglaLetters(reply) && !BANGLA_DIGIT.test(reply);
}
