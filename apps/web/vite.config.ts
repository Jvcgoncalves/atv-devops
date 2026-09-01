import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_NEST_API_TARGET = "http://localhost:3001";

// /api permanece mesma base pública; proxy encaminha requests ao Nest.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const nestApiTarget = env.API_PROXY_TARGET?.trim() || DEFAULT_NEST_API_TARGET;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: nestApiTarget,
          changeOrigin: true,
        },
        "/socket.io": {
          target: nestApiTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
