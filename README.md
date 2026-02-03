# cf-ollama-wrapper

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Ftino-kuptz%2Fcf-ollama-wrapper)

Ollama-compatible API on Cloudflare Workers.

> [!CAUTION]
> Ollama does not support authentication, so this COULD be abused. I can't be taken responsible in case high billing occures.  
> To reduce the likelihood of this happening, two options should be used:  
> * all API requests should be used with a path prefix, 
> * and the API should be restricted to specific IP addresses.
> 
> See **Security notes** below for more information.

## Supported endpoints and methods

As ollama does support more endpoints then Cloudflare could (e.g. pulling models), only some endpoints are implemented.

All those require the path prefix in the base URL, e.g.: `https://<worker>.<subdomain>.workers.dev/<path_prefix>`, e.g. `https://ollama-api.my-worker-domain.workers.dev/hdjfsbfkjhsabfjhsfdb`

| Method | Path           | Description        |
|--------|----------------|--------------------|
| GET    | `/api/tags`    | List models        |
| POST   | `/api/generate`| Simple completion  |
| POST   | `/api/chat`    | Chat with messages |
| POST   | `/api/embed`   | Create embeddings (untested) |
| POST   | `/api/ps`      | Currently loaded models (all models are always loaded for the next 30 days) |

### Compatibility

I tried to be as close to the official ollama api as possible. Please be aware, that cf isn't 100% compatible to ollama api, and so isn't this worker.

Token count wil be passed through from cf.  
For durations: `load_duration` and `prompt_eval_duration` are always `1`, as we don't receive them from cf. `total_duration` is the actual total duration, `eval_duration` is `total_duration - load_duration - prompt_eval_duration = total_duration - 2`. This is to not break compatibility for tools displaying that metrics or calculating with them (expecting them to not be 0).

Some parts can be customized in `src/config.ts`; e.g. if models appear with `:latest` tag in `/api/tags` or `/api/ps`.

#### Non campatible endpoints

As we can't load, unload, import or export models from cloudflare those endpoints are not supported. They'll return an http 400 error when called.

### A note about streaming

Streaming does "not really work". The calls will be executed without streaming in cloudflare, and streaming is then simulated to the client.  
That is because I'm too lazy to actually detect tool calls in stream requests. If you want to try doing so - feel free to.

## Security

Since Ollama does not support API authentiaction, inbound requests to this worker can be reduced to IPs (preferred API security) and additionally require to use a secret path prefix (additional security, but COULD be brute forced).

Please set the secrets beforehand:
```bash
npx wrangler secret put path_prefix   # e.g. /your-secret-path (no trailing slash)
npx wrangler secret put allowed_ips   # optional: comma-separated IPs; "1.1.1.1,1.0.0.1"
```
If you do not have a fixed public IP address, please ensure that the path prefix is sufficiently secure.

## Setting up the client

Use the **full API URL including the path prefix**. Do not enter only the domain.

- **Correct:** `https://cf-ollama-wrapper.tino-kuptz.workers.dev/your-path-prefix` (no trailing slash)
- **Wrong:** `https://cf-ollama-wrapper.tino-kuptz.workers.dev` (missing path prefix → 404)

### Home-Assistant

In **Settings → Devices & services → Add integration → Ollama**, enter that full URL as the “Ollama server URL”. The client will then request e.g. `…/your-path-prefix/api/tags` and the worker will accept it.

## Auth

> [!WARNING]
> The path prefix must always be at least 17 characters long ("/" + 16 characters).  
> This worker will block requests otherwise, to prevent abuse,

You need to configure the `path_prefix` when developing locally, too.

- **Path prefix**: Every request must use the path set in the `path_prefix` secret; otherwise the worker returns 404.
- **IP allowlist**: If the `allowed_ips` secret is set (comma-separated list), only those client IPs are allowed; others get 403. Uses `CF-Connecting-IP` when available.

## Local testing

Before testing create an `.env` with the following content:
```ini
path_prefix="/localdevelopmenttesting1212121212"
#allowed_ips=127.0.0.1,::1
```

### Chat (no tools)

Commands I use to test

#### Without streaming

```sh
curl http://localhost:8787/localdevelopmenttesting1212121212/api/chat -d '{
  "model": "llama3.1:70b",
  "messages": [
    {"role": "system", "content": "you are a helpful assistant"},
    {"role": "user", "content": "what time is it in NYC?"}
  ]
}'
```

returns json

```json
{
   "model":"llama3.1:70b",
   "message":{"role":"assistant","content":"The sky [...] light?"},
   "done":true,
   "total_duration":182242375,
   "load_duration":1,
   "prompt_eval_count":169,
   "prompt_eval_duration":1,
   "eval_count":15,
   "eval_duration":115959084
}
```

#### With streaming

```sh
curl http://localhost:8787/localdevelopmenttesting1212121212/api/chat -d '{
  "model": "llama3.1:70b",
  "messages": [
    {"role": "system", "content": "you are a helpful assistant"},
    {"role": "user", "content": "what time is it in NYC?"}
  ],
  "stream": true
}'
```

returns a stream:

```jsonc
{"model":"llama3.1:70b","created_at":"2026-02-03T08:54:45.903Z","message":{"role":"assistant","content":"However,"},"done":false}
{"model":"llama3.1:70b","created_at":"2026-02-03T08:54:45.903Z","message":{"role":"assistant","content":" "},"done":false}
// ...
{"model":"llama3.1:70b","created_at":"2026-02-03T08:54:45.903Z","message":{"role":"assistant","content":"ask!"},"done":false}
{"model":"llama3.1:70b","created_at":"2026-02-03T08:54:45.903Z","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop","total_duration":182242375,"load_duration":1,"prompt_eval_count":169,"prompt_eval_duration":1,"eval_count":15,"eval_duration":115959084}
```


### Chat (with tools)

#### Without streaming

```sh
curl http://localhost:8787/localdevelopmenttesting1212121212/api/chat -d '{
  "model": "llama3.3:70b",
  "messages": [
    {
      "role": "user",
      "content": "what is the weather in tokyo?"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get the weather in a given city",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {
              "type": "string",
              "description": "The city to get the weather for"
            }
          },
          "required": ["city"]
        }
      }
    }
  ],
  "stream": false
}'
```

Returns json:

```json
{
   "model":"llama3.3:70b",
   "message":{
      "role":"assistant",
      "content":"",
      "tool_calls":[
         {"function":{"name":"get_weather","arguments":{"city":"Tokyo"}}}
      ]
   },
   "done":true,
   "done_reason":"tool_calls",
   "total_duration":182242375,
   "load_duration":1,
   "prompt_eval_count":169,
   "prompt_eval_duration":1,
   "eval_count":15,
   "eval_duration":115959084
}
```

#### With streaming
```sh
curl http://localhost:8787/localdevelopmenttesting1212121212/api/chat -d '{
  "model": "llama3.3:70b",
  "messages": [
    {
      "role": "user",
      "content": "what is the weather in tokyo?"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get the weather in a given city",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {
              "type": "string",
              "description": "The city to get the weather for"
            }
          },
          "required": ["city"]
        }
      }
    }
  ],
  "stream": true
}'
```

Returns a stream

```json
{"model":"llama3.3:70b","message":{"role":"assistant","content":"","tool_calls":[{"function":{"name":"get_weather","arguments":{"city":"Tokyo"}}}]},"done":false}
{"model":"llama3.3:70b","message":{"role":"assistant","content":""},"done":true,"done_reason":"tool_calls","total_duration":182242375,"load_duration":1,"prompt_eval_count":169,"prompt_eval_duration":1,"eval_count":15,"eval_duration":115959084}
```