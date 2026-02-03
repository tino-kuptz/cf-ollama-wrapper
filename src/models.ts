import { defaultConfig } from "./config";

/**
 * Some models MIGHT need specific transformation of input and output
 * For this reason we have transformations here. Those can be attached on a PER MODEL basis.
 * Right now all models share the same transformations, so they didn't need to be on a PER MODEL basis in theory.
 * But in case that changes, only changes here need to be applied.
 * 
 * Received messages via api:
 *  - the message object will be translated via `model.inboundMessageToModel` (= `workersAiInboundMessage`)
 *  - the tool object will be translated via `model.inboundToolToModel` (= `workersAiInboundTool`)
 *  - the converted objects will be passed to `c.env.AI.run`
 *  - the response object will be translated via `model.outboundMessageFromModel` (= `workersAiOutboundMessage`)
 *  - the tool call object will be translated via `model.outboundToolcallFromModel` (= `workersAiOutboundToolcall`)
 *  - the converted objects will be returned to the api
 */

type OllamaMessage = { role?: string; content?: unknown;[key: string]: unknown };
type WorkersAiMessage = { role: string; content: string };
type OllamaTool = { type?: string; function?: { name: string; description?: string; parameters?: Record<string, unknown> } };
type WorkersAiTool = { name: string; description?: string; parameters?: Record<string, unknown> };
type WorkersAiResponse = { response: string; tool_calls?: Array<{ name: string; arguments?: unknown }> };
type OllamaToolCall = { function: { name: string; arguments: Record<string, unknown> } };

/**
 * Converts messages received from ollama api to workers ai messages
 * @param messages - ollama messages
 * @returns workers ai messages
 */
function workersAiInboundMessage(messages: OllamaMessage[]): WorkersAiMessage[] {
    return messages.map((m) => {
        const role = typeof m.role === "string" && m.role ? m.role : "user";
        let content: string;
        if (m.content === undefined || m.content === null) {
            content = "";
        } else if (typeof m.content === "string") {
            content = m.content;
        } else if (Array.isArray(m.content)) {
            content = m.content
                .map((part) => (typeof part === "object" && part && "text" in part ? (part as { text: string }).text : String(part)))
                .join("");
        } else {
            content = typeof m.content === "object" ? JSON.stringify(m.content) : String(m.content);
        }
        return { role, content };
    });
}

/**
 * Converts tools received from ollama api to workers ai tools
 * @param tools - ollama tools
 * @returns workers ai tools
 */
function workersAiInboundTool(
    tools?: OllamaTool[]
): WorkersAiTool[] | undefined {
    if (!tools?.length) return undefined;
    return tools
        .filter((t) => t.type === "function" && t.function?.name)
        .map((t) => {
            const params = t.function!.parameters ?? { type: "object", properties: {}, required: [] };
            const type = typeof params.type === "string" ? params.type : "object";
            const rawProps = params.properties && typeof params.properties === "object" ? params.properties : {};
            const required = Array.isArray(params.required) ? params.required : [];
            const properties: Record<string, { type: string; description: string }> = {};
            for (const [key, val] of Object.entries(rawProps)) {
                const v = val && typeof val === "object" ? (val as Record<string, unknown>) : {};
                properties[key] = {
                    type: typeof v.type === "string" ? v.type : "string",
                    description: typeof v.description === "string" ? v.description : "",
                };
            }
            return {
                name: t.function!.name,
                description: typeof t.function!.description === "string" ? t.function!.description : "",
                parameters: { type, properties, required },
            };
        });
}

/**
 * Converts model response to ollama message
 * @param res - model response
 * @returns ollama message
 */
function workersAiOutboundMessage(res: WorkersAiResponse): { role: "assistant"; content: string } {
    return { role: "assistant", content: res.response ?? "" };
}

/**
 * Converts tool calls to ollama tool calls
 * @param tool_calls - tool calls
 * @returns ollama tool calls
 */
function workersAiOutboundToolcall(
    tool_calls?: Array<{ name: string; arguments?: unknown }>
): OllamaToolCall[] | undefined {
    if (!tool_calls?.length) return undefined;
    return tool_calls.map((tc) => {
        let args: Record<string, unknown> = {};
        if (tc.arguments != null) {
            args =
                typeof tc.arguments === "string"
                    ? (() => {
                        try {
                            return (JSON.parse(tc.arguments as string) as Record<string, unknown>) ?? {};
                        } catch {
                            return {};
                        }
                    })()
                    : typeof tc.arguments === "object" && tc.arguments !== null
                        ? (tc.arguments as Record<string, unknown>)
                        : {};
        }
        return { function: { name: tc.name, arguments: args } };
    });
}

/**
 * This is the object that will be attached to each model.
 * It contains the transformations for inbound and outbound messages and tool calls.
 */
const WORKERS_AI_TRANSFORMS = {
    inboundMessageToModel: workersAiInboundMessage,
    inboundToolToModel: workersAiInboundTool,
    outboundMessageFromModel: workersAiOutboundMessage,
    outboundToolcallFromModel: workersAiOutboundToolcall,
};

interface Model {
    name: string;
    path: string;
    type: "text-generation" | "text-embedding";
    context_window: number;
    can_call_function: boolean;
    parameter_size: string;
    quantization_level: string;
    is_latest: boolean;
    inboundMessageToModel: (messages: OllamaMessage[]) => WorkersAiMessage[];
    inboundToolToModel: (tools?: OllamaTool[]) => WorkersAiTool[] | undefined;
    outboundMessageFromModel: (res: WorkersAiResponse) => { role: "assistant"; content: string };
    outboundToolcallFromModel: (tool_calls?: Array<{ name: string; arguments?: unknown }>) => OllamaToolCall[] | undefined;
}

// @todo: hier die Liste mal durchgehen und die Models tatsächlich glatt ziehen
// habe erst mal nur nen paar hier reingedumpt

export const ModelList: Model[] = [
    // https://ollama.com/library/deepseek-r1
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "deepseek-r1:32b",
        path: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        type: "text-generation",
        context_window: 80000,
        can_call_function: false,
        parameter_size: "32B",
        quantization_level: "fp8",
        is_latest: true,
    },
    // https://ollama.com/library/gpt-oss
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "gpt-oss:120b",
        path: "@cf/openai/gpt-oss-120b",
        type: "text-generation",
        context_window: 128000,
        can_call_function: false,
        parameter_size: "120B",
        quantization_level: "fp8",
        is_latest: true,
    },
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "gpt-oss:20b",
        path: "@cf/openai/gpt-oss-20b",
        type: "text-generation",
        context_window: 128000,
        can_call_function: false,
        parameter_size: "20B",
        quantization_level: "fp8",
        is_latest: false,
    },
    // https://ollama.com/library/llama3.1
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "llama3.1:8b",
        path: "@cf/meta/llama-3.1-8b-instruct-fast",
        type: "text-generation",
        context_window: 128000,
        can_call_function: false,
        parameter_size: "8B",
        quantization_level: "fp8",
        is_latest: false,
    },
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "llama3.1:70b",
        path: "@cf/meta/llama-3.1-70b-instruct",
        type: "text-generation",
        context_window: 24000,
        can_call_function: false,
        parameter_size: "70B",
        quantization_level: "fp8",
        is_latest: true,
    },
    // https://ollama.com/library/llama3.3
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "llama3.3:70b",
        path: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        type: "text-generation",
        context_window: 24000,
        can_call_function: true,
        parameter_size: "70B",
        quantization_level: "fp8",
        is_latest: true,
    },
    // https://ollama.com/library/llama4
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "llama4:16x17b",
        path: "@cf/meta/llama-4-scout-17b-16e-instruct",
        type: "text-generation",
        context_window: 131000,
        can_call_function: true,
        parameter_size: "17B",
        quantization_level: "fp8",
        is_latest: true,
    },
    // https://ollama.com/library/granite4
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "granite4:350m",
        path: "@cf/ibm-granite/granite-4.0-h-micro",
        type: "text-generation",
        context_window: 131000,
        can_call_function: true,
        parameter_size: "350M",
        quantization_level: "fp8",
        is_latest: true,
    },
    // https://ollama.com/library/gemma3
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "gemma3:12b",
        path: "@cf/google/gemma-3-12b-it",
        type: "text-generation",
        context_window: 80000,
        can_call_function: false,
        parameter_size: "12B",
        quantization_level: "fp8",
        is_latest: true,
    },
    // https://ollama.com/library/mistral
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "mistral-small:7b",
        path: "@hf/mistral/mistral-7b-instruct-v0.2",
        type: "text-generation",
        context_window: 3072,
        can_call_function: false,
        parameter_size: "7B",
        quantization_level: "fp8",
        is_latest: true,
    },
    // https://ollama.com/library/mistral-small
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "mistral-small:24b",
        path: "@cf/mistralai/mistral-small-3.1-24b-instruct",
        type: "text-generation",
        context_window: 128000,
        can_call_function: true,
        parameter_size: "24B",
        quantization_level: "fp8",
        is_latest: true,
    },

    // Text embedding models
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "bge-small:en",
        path: "@cf/baai/bge-small-en-v1.5",
        type: "text-embedding",
        context_window: 512,
        can_call_function: false,
        parameter_size: "Small",
        quantization_level: "fp8",
        is_latest: true,
    },
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "bge-base:en",
        path: "@cf/baai/bge-base-en-v1.5",
        type: "text-embedding",
        context_window: 512,
        can_call_function: false,
        parameter_size: "Base",
        quantization_level: "fp8",
        is_latest: true,
    },
    {
        ...WORKERS_AI_TRANSFORMS,
        name: "embeddinggemma:300m",
        path: "@cf/google/embeddinggemma-300m",
        type: "text-embedding",
        context_window: 8192,
        can_call_function: false,
        parameter_size: "300M",
        quantization_level: "fp8",
        is_latest: true,
    },
]

/**
 * Get a model by name
 * @param name - the name + tag of the model
 * @returns the model
 */
export const getModel = (name: string) => {
    if(name.indexOf(":") === -1) {
        name = name + ":latest";
    }
    const isLatest = name.endsWith(":latest");
    if (isLatest) {
        name = name.slice(name.length - ":latest".length);
        return ModelList.find((model) => model.name.split(":")[0] === name && model.is_latest);
    }
    return ModelList.find((model) => model.name === name);
}

/**
 * Get a text generation model by name
 * @param name - the name + tag of the model
 * @returns the model
 */
export const getTextGenerationModel = (name: string) => {
    if(name.indexOf(":") === -1) {
        name = name + ":latest";
    }
    const isLatest = name.endsWith(":latest");
    if (isLatest) {
        name = name.slice(name.length - ":latest".length);
        return ModelList.find((model) => model.type === "text-generation" && model.name.split(":")[0] === name && model.is_latest);
    }
    return ModelList.find((model) => model.type === "text-generation" && model.name === name);
}

/**
 * All text generation models
 * @returns array of text generation models
 */
export const getTextGenerationModels = () => {
    const models = ModelList.filter((model) => model.type === "text-generation");
    if (defaultConfig.latest_as_additional) {
        const startModelLength = models.length;
        for (var i = 0; i < startModelLength; i++) {
            if (!models[i].is_latest)
                continue;
            const thisModel = JSON.parse(JSON.stringify(models[i]));
            thisModel.name = thisModel.name.split(":")[0] + ":latest";
            models.push(thisModel);
        }
    }
    return models;
}

/**
 * All text embedding models
 * @returns array of text embedding models
 */
export const getTextEmbeddingModels = () => {
    const models = ModelList.filter((model) => model.type === "text-embedding");
    if (defaultConfig.latest_as_additional) {
        const startModelLength = models.length;
        for (var i = 0; i < startModelLength; i++) {
            if (!models[i].is_latest)
                continue;
            const thisModel = JSON.parse(JSON.stringify(models[i]));
            thisModel.name = thisModel.name.split(":")[0] + ":latest";
            models.push(thisModel);
        }
    }
    return models;
}

/**
 * Get a text embedding model by name
 * @param name - the name + tag of the model
 * @returns the model
 */
export const getTextEmbeddingModel = (name: string) => {
    if(name.indexOf(":") === -1) {
        name = name + ":latest";
    }
    const isLatest = name.endsWith(":latest");
    if (isLatest) {
        name = name.slice(name.length - ":latest".length);
        return ModelList.find((model) => model.type === "text-embedding" && model.name.split(":")[0] === name && model.is_latest);
    }
    return ModelList.find((model) => model.type === "text-embedding" && model.name === name);
}