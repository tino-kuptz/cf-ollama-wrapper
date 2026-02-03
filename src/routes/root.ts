import { Hono } from "hono";
import type { Env } from "../env.d";

const app = new Hono<{ Bindings: Env }>();

/**
 * In case an applications checks if ollama is up and running by simply GETting "/": this returns some data
 * @param c - context
 * @returns message
 */
app.get("/", (c) =>
    c.json({ error: false, message: "Ollama API is running" })
);

export default app;
