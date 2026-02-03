import { Hono } from "hono";
import type { Env } from "../env.d";
import { getTextEmbeddingModels, getTextGenerationModels } from "../models";
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
        digest: "", // set in handler below
        details: {
            parent_model: "",
            format: "gguf",
            family,
            families: [family],
            parameter_size: m.parameter_size,
            quantization_level: m.quantization_level,
        },
        // let all models expire in 30 days
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        size_vram: 5137025024
    };
}

/**
 * Returns all "running" models (all models are "always loaded for the next 30 days")
 * @param c - context
 * @returns models
 */
app.get("/api/ps", async (c) => {
    const gen = getTextGenerationModels().map(toOllamaModel);
    const emb = defaultConfig.return_embedding_models ? getTextEmbeddingModels().map(toOllamaModel) : [];
    const all = [...gen, ...emb];
    for (const m of all) {
        (m as { digest: string }).digest = await digestSha256(m.name);
    }
    return c.json({ models: all });
});

export default app;
