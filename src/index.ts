import { Hono } from "hono";
import { checkAuth } from "./middleware";
import type { Env } from "./env.d";


const app = new Hono<{ Bindings: Env }>();

// /
import rootRoutes from "./routes/root";
app.route("", rootRoutes);

// /api/tags
import tagsRoutes from "./routes/tags";
app.route("", tagsRoutes);

// /api/ps
import psRoutes from "./routes/ps";
app.route("", psRoutes);

// /api/generate
import generateRoutes from "./routes/generate";
app.route("", generateRoutes);

// /api/chat
import chatRoutes from "./routes/chat";
app.route("", chatRoutes);

// /api/embed
import embedRoutes from "./routes/embed";
app.route("", embedRoutes);

// Not supported routes
import unsupportedRoutes from "./routes/unsupported";
app.route("", unsupportedRoutes);

// catchall route / 404
import notFoundRoutes from "./routes/not-found";
app.route("", notFoundRoutes);

export default {
    async fetch(req: Request, env: Env): Promise<Response> {
        // First check if the request is authenticated
        const authResponse = checkAuth(req, env);
        if (authResponse) return authResponse;

        // Then strip the path prefix and create new request instance
        const url = new URL(req.url);
        const prefix = (env.path_prefix ?? "").trim();
        const pathWithoutPrefix = url.pathname.slice(prefix.length) || "/";
        const newUrl = new URL(req.url);
        newUrl.pathname = pathWithoutPrefix;
        const newReq = new Request(newUrl, req);

        // Finally let hono handle the request
        return app.fetch(newReq, env);
    },
};
