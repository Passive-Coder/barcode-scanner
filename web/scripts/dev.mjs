// Local development: the Vite dev server for the app, plus the Worker (API and local D1
// database) under `wrangler dev`. Vite forwards /api requests to the Worker, so the browser
// sees a single origin, http://localhost:3000.
//
//   npm run dev
//
// Apply the database schema once first: npx wrangler d1 migrations apply linework --local
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

export const API_PORT = 8787;

// wrangler expects the assets directory to exist; in development Vite serves the app instead.
mkdirSync(new URL("../dist", import.meta.url), { recursive: true });

const processes = [
  spawn("npx", ["wrangler", "dev", "--port", String(API_PORT), "--show-interactive-dev-session=false"], { stdio: "inherit" }),
  spawn("npx", ["vite"], { stdio: "inherit" }),
];

let stopping = false;
/** @param {number} code */
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill("SIGTERM");
  process.exitCode = code;
}

for (const child of processes) child.on("exit", (code) => stop(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
