import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    // When running behind nginx (docker compose), HMR connects on port 80
    // via the dedicated /_vite_ws location.
    hmr: {
      path: "/_vite_ws",
      clientPort: 80,
    },
    // Used only for standalone dev (npm run dev outside docker)
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/queues": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
