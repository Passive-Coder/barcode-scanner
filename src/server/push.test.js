import { generateKeyPairSync, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPushEndpoint, sendPush } from "./push.js";

/** A VAPID key pair in the format scripts/generate-vapid-keys.mjs writes. */
function vapidKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "jwk" });
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(/** @type {string} */ (pub.x), "base64url"), Buffer.from(/** @type {string} */ (pub.y), "base64url")]);
  return { VAPID_PUBLIC_KEY: raw.toString("base64url"), VAPID_PRIVATE_KEY: /** @type {string} */ (privateKey.export({ format: "jwk" }).d), VAPID_SUBJECT: "https://linework.test" };
}

/** A browser's subscription keys: its own P-256 public key and a 16-byte secret. */
function browserSubscription(endpoint = "https://fcm.googleapis.com/fcm/send/device") {
  const { publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "jwk" });
  const p256dh = Buffer.concat([Buffer.from([4]), Buffer.from(/** @type {string} */ (pub.x), "base64url"), Buffer.from(/** @type {string} */ (pub.y), "base64url")]).toString("base64url");
  return { endpoint, p256dh, auth: randomBytes(16).toString("base64url") };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("web push", () => {
  it("recognises browser push services only", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/QK0abc")).toBe(true);
    expect(isPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=abc")).toBe(true);
    expect(isPushEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isPushEndpoint("not a url")).toBe(false);
  });

  it("sends VAPID-signed, encrypted messages and reports expired devices", async () => {
    /** @type {Array<{ url: string, init: any }>} */
    const requests = [];
    vi.stubGlobal("fetch", async (/** @type {string} */ url, /** @type {any} */ init) => {
      requests.push({ url, init });
      return new Response(null, { status: url.endsWith("gone") ? 410 : 201 });
    });
    const keys = vapidKeys();
    const expired = await sendPush(keys, [browserSubscription(), browserSubscription("https://fcm.googleapis.com/fcm/send/gone")], { type: "alert", title: "Hello" }, { urgent: true, ttlSeconds: 60 });

    expect(expired).toEqual(["https://fcm.googleapis.com/fcm/send/gone"]);
    expect(requests).toHaveLength(2);
    const { headers, body } = requests[0].init;
    expect(headers.authorization).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${keys.VAPID_PUBLIC_KEY}$`));
    expect(headers["content-encoding"]).toBe("aes128gcm");
    expect(headers.urgency).toBe("high");
    expect(headers.ttl).toBe("60");
    // The payload is encrypted: the plain text never appears in the body.
    expect(Buffer.from(body).toString("utf8")).not.toContain("Hello");
  });

  it("does nothing without VAPID keys", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await sendPush({}, [browserSubscription()], { type: "alert" }, { urgent: false, ttlSeconds: 60 })).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
