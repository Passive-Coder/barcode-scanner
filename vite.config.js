import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // DEV_PORT has no VITE_ prefix, so it configures the server without reaching the browser bundle.
  const env = loadEnv(mode, process.cwd(), "");
  // Google only accepts sign-in from Authorized JavaScript origins, so the port must not drift.
  const port = Number(env.DEV_PORT) || 3000;

  return {
    plugins: [svelte()],
    resolve: {
      alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
    },
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    build: { target: "es2022" },
    // The zxing-wasm decoder runs in a module worker.
    worker: { format: "es" },
    test: {
      include: ["src/**/*.test.js"],
      environment: "node",
    },
  };
});
