import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "../logger.ts";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  logger.error({ err: err }, "[api] unhandled error");
  return c.json({ error: { message: "Internal Server Error" } }, 500);
};
