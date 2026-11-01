export type ChunkOptions = {
  maxChars?: number;
  overlapChars?: number;
};

export const DEFAULT_MAX_CHARS = 1200;
export const DEFAULT_OVERLAP_CHARS = 200;

const SENTENCE_BOUNDARY = /(?<=[.!?।])\s+/;

function hardSplit(text: string, maxChars: number): string[] {
  const parts: string[] = [];

  for (let index = 0; index < text.length; index += maxChars) {
    parts.push(text.slice(index, index + maxChars));
  }

  return parts;
}

function toSentences(sentences: string[], maxChars: number): string[] {
  return sentences.flatMap((sentence) =>
    sentence.length > maxChars ? hardSplit(sentence, maxChars) : [sentence],
  );
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;

  if (maxChars <= 0) {
    throw new Error("maxChars must be greater than zero");
  }

  if (overlapChars < 0 || overlapChars >= maxChars) {
    throw new Error("overlapChars must be at least zero and smaller than maxChars");
  }

  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length === 0) {
    return [];
  }

  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const sentences = toSentences(normalized.split(SENTENCE_BOUNDARY), maxChars);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  const flush = () => {
    if (current.length > 0) {
      chunks.push(current.join(" "));
    }
  };

  const overlapTail = () => {
    const tail: string[] = [];
    let length = 0;

    for (let index = current.length - 1; index >= 0; index -= 1) {
      const sentence = current[index];

      if (sentence === undefined || length + sentence.length + 1 > overlapChars) {
        break;
      }

      tail.unshift(sentence);
      length += sentence.length + 1;
    }

    return { tail, length };
  };

  for (const sentence of sentences) {
    if (currentLength + sentence.length + 1 > maxChars && current.length > 0) {
      flush();
      const { tail, length } = overlapTail();
      current = tail;
      currentLength = length;
    }

    current.push(sentence);
    currentLength += sentence.length + 1;
  }

  flush();

  return chunks;
}
