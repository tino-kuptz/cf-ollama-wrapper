import type { Env } from "./env.d";

/**
 * Runs path prefix and optional IP allowlist checks.
 * Returns a Response to send (403) or null if checks pass.
 * Used at the worker entry before stripping path_prefix and passing to Hono.
 * @param req - request
 * @param env - environment
 * @returns response or null
 */
export function checkAuth(req: Request, env: Env): Response | null {
    const url = new URL(req.url);
    const prefix = (env.path_prefix ?? "").trim();
    if ((env.path_prefix ?? "").length <= 17) {
        // Security measurement: secret path prefix should be at least 16 characters long ("/" + 16 chars)
        return new Response("Forbidden: path prefix too short", { status: 403 });
    }
    if (!prefix || !url.pathname.startsWith(prefix)) {
        return new Response(
            JSON.stringify({
                error: "Path prefix required"
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
        );
    }

    const allowedIps = env.allowed_ips?.trim();
    if (allowedIps) {
        const ip = req.headers.get("CF-Connecting-IP") ?? "";
        const list = allowedIps
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        if (list.length > 0 && !list.includes(ip)) {
            return new Response(
                JSON.stringify({
                    error: "IP not allowed",
                    your_detected_ip: ip
                }),
                { status: 403, headers: { "Content-Type": "application/json" } }
            );
        }
    }

    return null;
}