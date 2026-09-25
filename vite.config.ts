import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string }

// Where the dev server forwards /api. Points at the compose service when the
// dev container runs the app, and at a locally run PocketBase otherwise.
const proxyTarget = process.env.PB_PROXY_TARGET || "http://127.0.0.1:8091"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    // In production PocketBase serves the frontend and the API from one port.
    // Proxying here gives development the same single origin, so the app never
    // needs a backend URL baked into the bundle.
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
        ws: true,
      },
    },
    // Polling keeps HMR reliable when the project is edited through a mounted
    // workspace where native filesystem events are not always forwarded.
    watch: {
      usePolling: true,
      interval: 100,
      ignored: ["**/pb_data/**"],
    },
  },
})
