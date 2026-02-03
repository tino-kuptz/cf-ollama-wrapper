import { Hono } from "hono";
import type { Env } from "../env.d";

const app = new Hono<{ Bindings: Env }>();

/**
 * Returns a 404 error for all unknown routes
 * @param c - context
 * @returns 404 error
 */
app.all("*", (c) => c.json({ error: true, message: "404 page not found: " + c.req.url }, 404));

export default app;