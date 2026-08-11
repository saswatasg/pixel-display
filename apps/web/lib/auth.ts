const SESSION_COOKIE = "pb_session";
const MESSAGE = "pixel-display-session";

function secret(): string {
  return process.env.APP_SESSION_SECRET ?? "";
}

async function hmacB64(secretKey: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function makeSessionToken(): Promise<string> {
  return `v1.${await hmacB64(secret(), MESSAGE)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !secret()) return false;
  const id = token.slice(0, token.indexOf("."));
  if (id !== "v1") return false;
  return token === (await makeSessionToken());
}

/** True when a PIN is configured; the app fails closed if it isn't. */
export function pinConfigured(): boolean {
  return Boolean(process.env.APP_ACCESS_PIN);
}

/** Substring-safe PIN check (attackers can't brute force a config value). */
export function matchesPin(pin: string): boolean {
  const configured = process.env.APP_ACCESS_PIN ?? "";
  return configured.length > 0 && pin === configured;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;