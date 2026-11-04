import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const API_TARGET = "http://localhost:3000";

export default defineConfig(({ mode }) => {
  // Vite refuses a request whose Host header it does not recognise, and every
  // request that arrives through the development tunnel carries the public
  // hostname. The list comes from the environment so no hostname is committed.
  const allowedHosts = (loadEnv(mode, process.cwd(), "VITE_").VITE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter((host) => host.length > 0);

  return {
    plugins: [
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react({ compiler: true }),
    ],
    server: {
      port: 5173,
      strictPort: true,
      ...(allowedHosts.length > 0 ? { allowedHosts } : {}),
      // The API is its own server in development. Proxying it keeps every request
      // same-origin: no CORS, first-party cookies, and the tunnel needs a single
      // rule pointing the public hostname here instead of one rule per path.
      proxy: {
        "/api": { target: API_TARGET },
        "/webhooks": { target: API_TARGET },
        "/data-deletion": { target: API_TARGET },
      },
    },
  };
});
