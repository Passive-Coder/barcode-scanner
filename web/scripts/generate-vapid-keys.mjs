// Generates a VAPID key pair for Web Push (RFC 8292) and stores it for local development.
//
//   node scripts/generate-vapid-keys.mjs
//
// The public key is printed (it is public: browsers use it to subscribe). The private key is
// written only to .dev.vars, which git ignores; production gets it as a Worker secret:
//   npx wrangler secret put VAPID_PRIVATE_KEY   (paste the value from .dev.vars)
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });

const raw = Buffer.concat([Buffer.from([4]), Buffer.from(String(pub.x), "base64url"), Buffer.from(String(pub.y), "base64url")]);
const vapidPublicKey = raw.toString("base64url");

const file = new URL("../.dev.vars", import.meta.url);
const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n").filter((line) => line && !/^VAPID_(PUBLIC|PRIVATE)_KEY=/.test(line)) : [];
lines.push(`VAPID_PUBLIC_KEY=${vapidPublicKey}`, `VAPID_PRIVATE_KEY=${priv.d}`);
writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });

console.log(`VAPID public key (safe to publish):\n${vapidPublicKey}\n\nPrivate key written to .dev.vars only.`);
