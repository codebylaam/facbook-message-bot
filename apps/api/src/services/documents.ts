import { DOCUMENT_EXTENSIONS } from "@fb-bot/shared";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

/** Raised when a file cannot be turned into text, with a message worth showing. */
export class UnsupportedDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedDocumentError";
  }
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");

  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function isAllowedDocument(name: string): boolean {
  return (DOCUMENT_EXTENSIONS as readonly string[]).includes(extensionOf(name));
}

export function mimeTypeFor(name: string): string {
  return MIME_BY_EXTENSION[extensionOf(name)] ?? "text/plain";
}

function decodeUtf8(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8").decode(bytes);

  // A byte-order mark would otherwise become the first character of the first chunk.
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Turns the upload into the text retrieval will index. Text formats decode
 * directly; a file that carries NUL bytes is almost certainly a binary document
 * that was renamed, and saying so is friendlier than embedding mojibake.
 */
export function readDocument(
  name: string,
  bytes: Uint8Array,
): { mimeType: string; content: string } {
  if (!isAllowedDocument(name)) {
    throw new UnsupportedDocumentError(
      `Only ${DOCUMENT_EXTENSIONS.join(", ")} files are supported.`,
    );
  }

  const text = decodeUtf8(bytes);

  if (text.includes("\u0000")) {
    throw new UnsupportedDocumentError(
      "That file looks like a binary document. Save it as .md, .txt or .csv and try again.",
    );
  }

  return {
    mimeType: mimeTypeFor(name),
    content: text.replace(/\r\n?/g, "\n").trim(),
  };
}
