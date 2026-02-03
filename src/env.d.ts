export interface Env {
    AI: Ai;
    path_prefix: string;
    allowed_ips?: string;
}

interface Ai {
    run(
        model: string,
        options: {
            prompt?: string;
            messages?: Array<{ role: string; content: string }>;
            tools?: Array<{ name: string; description?: string; parameters?: { type?: string; properties?: Record<string, unknown>; required?: string[] } }>;
            max_tokens?: number;
        }
    ): Promise<{
        response: string;
        tool_calls?: Array<{ name: string; arguments?: unknown }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }>;
}
