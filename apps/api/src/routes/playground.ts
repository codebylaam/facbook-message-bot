import { playgroundRequestSchema } from "@fb-bot/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { embeddings, llm } from "../ai.ts";
import { db } from "../db.ts";
import { isLlmConfigured } from "../env.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";
import { PageConnectionError } from "../services/pages.ts";
import { runPlayground } from "../services/playground.ts";
import { resolveOwnedPageId } from "./page-scope.ts";

export const playgroundRoute = new Hono<AppEnv>();

playgroundRoute.use("*", requireSession);

playgroundRoute.get("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));

  return c.json({ configured: isLlmConfigured, pageId });
});

playgroundRoute.post("/", zValidator("json", playgroundRequestSchema), async (c) => {
  if (!isLlmConfigured) {
    throw new HTTPException(503, {
      message: "CMD_API_KEY is not set, so the reply model cannot be called",
    });
  }

  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const { message, history } = c.req.valid("json");

  try {
    const result = await runPlayground({ db, llm, embeddings }, { pageId, message, history });
    return c.json(result);
  } catch (error) {
    if (error instanceof PageConnectionError) {
      throw new HTTPException(error.status, { message: error.message });
    }

    throw error;
  }
});
