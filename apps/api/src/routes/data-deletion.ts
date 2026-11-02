import { parseSignedRequest } from "@fb-bot/meta";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env, isMetaConfigured } from "../env.ts";
import { logger } from "../logger.ts";

export const dataDeletionRoute = new Hono();

/**
 * Meta calls this when someone asks Facebook to delete their data. We cannot map
 * the Facebook user id to an account because the seller's Facebook identity is
 * never stored, so the callback hands back a URL where the signed in seller
 * completes the deletion themselves.
 */
dataDeletionRoute.post("/", async (c) => {
  if (!isMetaConfigured) {
    throw new HTTPException(503, {
      message: "The Facebook app is not configured on this server",
    });
  }

  const contentType = c.req.header("content-type") ?? "";
  let signedRequest: string | undefined;

  if (contentType.includes("application/json")) {
    const body = (await c.req.json().catch(() => ({}))) as { signed_request?: unknown };
    signedRequest = typeof body.signed_request === "string" ? body.signed_request : undefined;
  } else {
    const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    const value = body.signed_request;
    signedRequest = typeof value === "string" ? value : undefined;
  }

  if (!signedRequest) {
    throw new HTTPException(400, { message: "signed_request is required" });
  }

  const payload = parseSignedRequest(env.META_APP_SECRET, signedRequest);

  if (!payload) {
    throw new HTTPException(403, { message: "Invalid signed_request signature" });
  }

  const confirmationCode = crypto.randomUUID();
  const fbUserId = typeof payload.user_id === "string" ? payload.user_id : null;

  logger.info(
    { confirmationCode, hasFacebookUserId: fbUserId !== null },
    "received a data deletion request",
  );

  return c.json({
    url: `${env.WEB_ORIGIN}/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
});
