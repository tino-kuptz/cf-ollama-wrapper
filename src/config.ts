/**
 * Default config for Ollama-compatible API.
 * Request options (e.g. options.num_ctx) override these when provided.
 */
export const defaultConfig = {
    /** Context size (Ollama: num_ctx). Passed to Workers AI as max_tokens when supported. */
    num_ctx: 4096,

    /** append models with ":latest" tag? If set to true, more models will be returned in `/api/tags` and `/api/ps` */
    latest_as_additional: false,

    /** return embedding models? As this is currently untested, it's disabled by default */
    return_embedding_models: false,
} as const;

export type DefaultConfig = typeof defaultConfig;
