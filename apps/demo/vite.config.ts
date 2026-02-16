import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite plugin that proxies arbitrary model download URLs to avoid CORS.
 * Handles: GET /tripo-model-proxy?url=<encoded-cdn-url>
 */
function tripoModelProxy(): Plugin {
  return {
    name: "tripo-model-proxy",
    configureServer(server) {
      server.middlewares.use("/tripo-model-proxy", async (req, res) => {
        const reqUrl = (req as { url?: string }).url ?? "";
        const url = new URL(reqUrl, "http://localhost");
        const modelUrl = url.searchParams.get("url");

        if (!modelUrl) {
          res.statusCode = 400;
          res.end("Missing ?url= parameter");
          return;
        }

        try {
          const upstream = await fetch(modelUrl);
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.end(`Upstream error: ${upstream.status}`);
            return;
          }

          res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
          const arrayBuf = await upstream.arrayBuffer();
          res.end(new Uint8Array(arrayBuf));
        } catch (err) {
          res.statusCode = 502;
          res.end(`Proxy error: ${err}`);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tripoModelProxy()],
  server: {
    proxy: {
      // Proxy Tripo API requests to avoid CORS issues in development
      "/tripo-api": {
        target: "https://api.tripo3d.ai",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tripo-api/, "/v2/openapi"),
      },
    },
  },
});
