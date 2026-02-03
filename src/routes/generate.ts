import { Hono } from "hono";
import { defaultConfig } from "../config";
import { getTextGenerationModel } from "../models";
import type { Env } from "../env.d";

const app = new Hono<{ Bindings: Env }>();

/**
 * Generates text
 * @param c - context
 * @returns generated text
 */
app.post("/api/generate", async (c) => {
    const body = (await c.req.json()) as { model?: string; prompt?: string; options?: { num_ctx?: number } };
    const { model, prompt, options: reqOptions } = body;
    if (!model || prompt === undefined) {
        return c.json({ error: "model and prompt required" }, 400);
    }
    const modelEntry = getTextGenerationModel(model);
    if (!modelEntry || modelEntry.type !== "text-generation") {
        return c.json({ error: `unknown model: ${model}` }, 400);
    }
    const num_ctx = reqOptions?.num_ctx ?? defaultConfig.num_ctx;
    const res = await c.env.AI.run(modelEntry.path, {
        prompt: prompt ?? "",
        max_tokens: num_ctx,
    });
    return c.json({
        model,
        response: res.response,
        done: true,
    });
});

export default app;
