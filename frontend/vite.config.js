import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      host: env.VITE_DEV_HOST || "0.0.0.0",
      port: Number(env.VITE_DEV_PORT || 5173),
      proxy: {
        "/api": {
          target: env.VITE_DEV_API_PROXY_TARGET || "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: env.VITE_PREVIEW_HOST || "0.0.0.0",
      port: Number(env.VITE_PREVIEW_PORT || 4173),
    },
  };
});
