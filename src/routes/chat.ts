import { Hono } from "hono";
import { getTextGenerationModel } from "../models";
import type { Env } from "../env.d";
import { defaultConfig } from "../config";

const app = new Hono<{ Bindings: Env }>();

/**
 * Ollama-style timing/usage (durations in nanoseconds; load/prompt_eval_duration = 1 when unknown).
 * @param startMs - start time
 * @param endMs - end time
 * @param usage - usage
 * @returns metrics
 */
function buildMetrics(
    startMs: number,
    endMs: number,
    usage?: { prompt_tokens?: number; completion_tokens?: number }
): {
    total_duration: number;
    load_duration: number;
    prompt_eval_count: number;
    prompt_eval_duration: number;
    eval_count: number;
    eval_duration: number;
} {
    const totalNs = Math.round((endMs - startMs) * 1e6);
    const load_duration = 1;
    const prompt_eval_duration = 1;
    const eval_duration = Math.max(0, totalNs - load_duration - prompt_eval_duration);
    return {
        total_duration: totalNs,
        load_duration,
        prompt_eval_count: usage?.prompt_tokens ?? 0,
        prompt_eval_duration,
        eval_count: usage?.completion_tokens ?? 0,
        eval_duration,
    };
}

/**
 * Split text into word-like chunks for fake streaming (preserves spaces).
 * @param text - text to split
 * @returns array of chunks
 */
function chunkForStream(text: string): string[] {
    if (!text) return [];
    return text.split(/(\s+)/).filter(Boolean);
}

/**
 * Chat with a model
 * @param c - context
 * @returns chat response
 */
app.post("/api/chat", async (c) => {
    const body = (await c.req.json()) as {
        model?: string;
        messages?: Array<{ role?: string; content?: unknown;[key: string]: unknown }>;
        tools?: Array<{ type?: string; function?: { name: string; description?: string; parameters?: Record<string, unknown> } }>;
        stream?: boolean;
        options?: { num_ctx?: number };
    };

    const { model, messages: rawMessages, tools: ollamaTools, stream: wantStream } = body;
    if (!model || !rawMessages?.length) {
        return c.json({ error: "model and messages required" }, 400);
    }
    const modelEntry = getTextGenerationModel(model);
    if (!modelEntry || modelEntry.type !== "text-generation") {
        return c.json({ error: `unknown model: ${model}` }, 400);
    }

    const messages = modelEntry.inboundMessageToModel(rawMessages);
    const workersTools = modelEntry.inboundToolToModel(ollamaTools);
    const runOptions: {
        messages: typeof messages;
        tools?: ReturnType<typeof modelEntry.inboundToolToModel>;
        max_tokens?: number;
    } = { messages, max_tokens: body.options?.num_ctx ?? defaultConfig.num_ctx };
    if (workersTools?.length) runOptions.tools = workersTools;
    
    const startMs = performance.now();
    const res = await c.env.AI.run(modelEntry.path, runOptions);
    const endMs = performance.now();
    const metrics = buildMetrics(startMs, endMs, res.usage);

    const messageOut = modelEntry.outboundMessageFromModel(res);
    const tool_calls = modelEntry.outboundToolcallFromModel(res.tool_calls);

    if (tool_calls?.length) {
        if (wantStream) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                model,
                                message: { ...messageOut, tool_calls },
                                done: false,
                            }) + "\n"
                        )
                    );
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                model,
                                message: { role: "assistant", content: "" },
                                done: true,
                                done_reason: "tool_calls",
                                ...metrics,
                            }) + "\n"
                        )
                    );
                    controller.close();
                },
            });
            return new Response(stream, {
                headers: {
                    "Content-Type": "application/x-ndjson",
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                },
            });
        }
        return c.json({
            model,
            message: { ...messageOut, tool_calls },
            done: true,
            done_reason: "tool_calls",
            ...metrics,
        });
    }

    if (wantStream) {
        const created_at = new Date().toISOString();
        const fullContent = messageOut.content;
        const chunks = chunkForStream(fullContent);
        const stream = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();
                for (let i = 0; i < chunks.length; i++) {
                    const content = chunks[i];
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                model,
                                created_at,
                                message: { role: "assistant", content },
                                done: false,
                            }) + "\n"
                        )
                    );
                }
                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({
                            model,
                            created_at,
                            message: { role: "assistant", content: "" },
                            done: true,
                            done_reason: "stop",
                            ...metrics,
                        }) + "\n"
                    )
                );
                controller.close();
            },
        });
        return new Response(stream, {
            headers: {
                "Content-Type": "application/x-ndjson",
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        });
    }

    return c.json({
        model,
        message: messageOut,
        done: true,
        ...metrics,
    });
});

export default app;
