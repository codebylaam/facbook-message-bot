import { Hono } from "hono";
import { type AppEnv, requireSession } from "../middleware/auth.ts";

export const meRoute = new Hono<AppEnv>();

meRoute.use("*", requireSession);

meRoute.get("/", (c) => {
  const user = c.get("user");
  const session = c.get("session");

  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
  });
});
