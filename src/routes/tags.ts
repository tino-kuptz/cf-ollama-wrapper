import { Hono } from "hono";
import { getTextGenerationModels, getTextEmbeddingModels } from "../models";
import type { Env } from "../env.d";
import { defaultConfig } from "../config";

const app = new Hono<{ Bindings: Env }>();

/**
 * Digests a text to a sha256 hash
 * @param text - text to digest
 * @returns sha256 hash
 */
async function digestSha256(text: string): Promise<string> {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Converts a model to an ollama model
 * @param m - model
 * @returns ollama model
 */
function toOllamaModel(m: {
    name: string;
    type: string;
    context_window: number;
    parameter_size: string;
    quantization_level: string;
}) {
    const family = m.name.split(/[-.]/)[0] ?? "unknown";
    return {
        name: m.name,
        model: m.name,
        modified_at: "2025-02-01T00:00:00.000Z",
        size: 3338801804,
        digest: "", // set in handler (async)
        details: {
            format: "gguf",
            family,
            families: [family],
            parameter_size: m.parameter_size,
            quantization_level: m.quantization_level,
            context_window: m.context_window,
        },
    };
}

/**
 * Returns all models
 * @param c - context
 * @returns models
 */
app.get("/api/tags", async (c) => {
    const gen = getTextGenerationModels().map(toOllamaModel);
    const emb = defaultConfig.return_embedding_models ? getTextEmbeddingModels().map(toOllamaModel) : [];
    const all = [...gen, ...emb];
    for (const m of all) {
        (m as { digest: string }).digest = await digestSha256(m.name);
    }
    return c.json({ models: all });
});

export default app;
