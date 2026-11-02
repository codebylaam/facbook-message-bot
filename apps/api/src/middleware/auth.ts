import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { type AuthSession, auth } from "../auth.ts";

export type AuthVariables = {
  user: AuthSession["user"];
  session: AuthSession["session"];
};

export type AppEnv = { Variables: AuthVariables };

export const attachSession = createMiddleware<AppEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });

  if (result) {
    c.set("user", result.user);
    c.set("session", result.session);
  }

  await next();
});

export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!result) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  c.set("user", result.user);
  c.set("session", result.session);

  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!result) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  if (result.user.role !== "admin") {
    throw new HTTPException(403, { message: "This area is for admins only" });
  }

  c.set("user", result.user);
  c.set("session", result.session);

  await next();
});
