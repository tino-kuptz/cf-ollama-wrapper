# cf-ollama-wrapper

> [!CAUTION]
> Ollama does not support authentication, so this COULD be abused. I can't be taken responsible in case high billing occures.  
> To reduce the likelihood of this happening, two options should be used:  
> * all API requests should be used with a path prefix, 
> * and the API should be restricted to specific IP addresses.
> 
> See **Security notes** below for more information.

Ollama-compatible API on Cloudflare Workers.

See [compatibility page](https://github.com/tino-kuptz/cf-ollama-wrapper/wiki/Ollama-compatibility) in the wiki for further information.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Ftino-kuptz%2Fcf-ollama-wrapper)

## Security

Since Ollama does not support API authentiaction, inbound requests to this worker can be reduced to IPs (preferred API security) and additionally require to use a secret path prefix (additional security, but COULD be brute forced).

Please set the secrets beforehand:
```bash
# e.g. /your-secret-path (no trailing slash)
npx wrangler secret put path_prefix

# optional: comma-separated IPs; "1.1.1.1,1.0.0.1"
npx wrangler secret put allowed_ips
```

If you do not have a fixed public IP address, please ensure that the path prefix is sufficiently secure (32+ characters).

## Setting up the client

Use the **full API URL including the path prefix**. Do not enter only the domain.

**Correct:** `https://cf-ollama-wrapper.tino-kuptz.workers.dev/your-path-prefix` (no trailing slash)
**Wrong:** `https://cf-ollama-wrapper.tino-kuptz.workers.dev` (missing path prefix → 404)
