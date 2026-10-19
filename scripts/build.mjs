import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "dist");

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

cpSync(join(root, "index.html"), join(output, "index.html"));
cpSync(join(root, "src"), join(output, "src"), { recursive: true });
cpSync(join(root, "vendor", "dynamsoft"), join(output, "vendor", "dynamsoft"), { recursive: true });

console.log("Cloudflare Pages assets prepared in dist/");
