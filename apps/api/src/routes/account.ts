import { deleteUserById, findUserById } from "@fb-bot/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "../auth.ts";
import { db } from "../db.ts";
import { logger } from "../logger.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";

export const accountRoute = new Hono<AppEnv>();

accountRoute.use("*", requireSession);

/**
 * Deletes the seller and everything hanging off them: pages, posts, products,
 * conversations, comments, leads, usage and the subscription all cascade.
 */
accountRoute.delete("/", async (c) => {
  const user = c.get("user");

  const existing = await findUserById(db, user.id);

  if (!existing) {
    throw new HTTPException(404, { message: "Account not found" });
  }

  await deleteUserById(db, user.id);
  logger.info({ userId: user.id }, "deleted an account on request");

  try {
    await auth.api.signOut({ headers: c.req.raw.headers });
  } catch {
    // The session is already gone with the user row.
  }

  return c.json({ deleted: true });
});
