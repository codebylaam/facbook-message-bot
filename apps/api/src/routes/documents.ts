import {
  createDocumentForPage,
  deleteChunksForSource,
  deleteDocumentForPage,
  listDocumentsForPage,
} from "@fb-bot/db";
import { DOCUMENT_MAX_BYTES, QUEUES } from "@fb-bot/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";
import { enqueue } from "../queue.ts";
import { readDocument, UnsupportedDocumentError } from "../services/documents.ts";
import { resolveOwnedPageId } from "./page-scope.ts";

export const documentsRoute = new Hono<AppEnv>();

documentsRoute.use("*", requireSession);

type DocumentRow = Awaited<ReturnType<typeof listDocumentsForPage>>[number];

function toDocument(row: DocumentRow) {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

documentsRoute.get("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const documents = await listDocumentsForPage(db, pageId);

  return c.json({ pageId, documents: documents.map(toDocument) });
});

documentsRoute.post("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));

  let body: Record<string, unknown>;

  try {
    body = await c.req.parseBody();
  } catch {
    throw new HTTPException(400, { message: "Send the document as multipart form data" });
  }

  const file = body.file;

  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: 'Attach the document as a file field named "file"' });
  }

  if (file.size === 0) {
    throw new HTTPException(400, { message: "That file is empty" });
  }

  if (file.size > DOCUMENT_MAX_BYTES) {
    throw new HTTPException(413, {
      message: `Documents have to be smaller than ${Math.round(DOCUMENT_MAX_BYTES / 1024 / 1024)} MB`,
    });
  }

  let parsed: { mimeType: string; content: string };

  try {
    parsed = readDocument(file.name, new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    throw new HTTPException(400, {
      message:
        error instanceof UnsupportedDocumentError ? error.message : "Could not read that document",
    });
  }

  if (parsed.content.length === 0) {
    throw new HTTPException(400, { message: "That document has no text to learn from" });
  }

  const document = await createDocumentForPage(db, pageId, {
    name: file.name,
    mimeType: parsed.mimeType,
    byteSize: file.size,
    content: parsed.content,
  });

  if (!document) {
    throw new HTTPException(500, { message: "Could not save the document" });
  }

  await enqueue(QUEUES.reembed, { pageId, sourceType: "document", sourceId: document.id });

  return c.json({ document: toDocument(document) }, 201);
});

documentsRoute.delete("/:id", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const documentId = c.req.param("id");
  const removed = await deleteDocumentForPage(db, pageId, documentId);

  if (!removed) {
    throw new HTTPException(404, { message: "Document not found" });
  }

  // Synchronously, not through the queue, so the bot cannot cite a document the
  // seller has just deleted while the job is still pending.
  await deleteChunksForSource(db, pageId, "document", documentId);

  return c.json({ success: true });
});
