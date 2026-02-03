import { Hono } from "hono";
import { getTextEmbeddingModel } from "../models";
import type { Env } from "../env.d";

const app = new Hono<{ Bindings: Env }>();

/**
 * Creates an embedding for a text
 * @warning This is currently untested, so it might not work as expected
 * @param c - context
 * @returns embedded text
 */
app.post("/api/embed", async (c) => {
    const body = (await c.req.json()) as {
        model?: string;
        input?: string | string[];
    };
    const { model, input } = body;
    if (!model || input === undefined) {
        return c.json({ error: "model and input required" }, 400);
    }
    const modelEntry = getTextEmbeddingModel(model);
    if (!modelEntry) {
        return c.json({ error: `unknown embedding model: ${model}` }, 400);
    }
    const texts = Array.isArray(input) ? input : [input];
    const runEmbed = c.env.AI.run as unknown as (
        model: string,
        options: { text: string | string[] }
    ) => Promise<{ shape: number[]; data: number[][] }>;
    const res = await runEmbed(modelEntry.path, { text: texts });
    const embeddings: number[][] = Array.isArray(res.data)
        ? res.data
        : [res.data as number[]];
    return c.json({ model, embeddings });
});

export default app;
