import { Hono } from "hono";
import type { Env } from "../env.d";

const app = new Hono<{ Bindings: Env }>();

const UNSUPPORTED_POST_PATHS = [
    "/api/copy",
    "/api/create",
    "/api/delete",
    "/api/pull",
    "/api/push",
];

/**
 * Unsupported POST paths
 * @param c - context
 * @returns 400 error
 */
for (const path of UNSUPPORTED_POST_PATHS) {
    app.post(path, (c) => c.json({ error: true, message: "Not supported" }, 400));
}

export default app;
