import { Hono } from "hono";
import { client } from "../db.ts";

export const healthRoute = new Hono();

healthRoute.get("/", (c) =>
  c.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }),
);

healthRoute.get("/db", async (c) => {
  try {
    await client`select 1`;
    return c.json({ status: "ok", database: "up" });
  } catch (error) {
    console.error("[api] database health check failed", error);
    return c.json({ status: "degraded", database: "down" }, 503);
  }
});
