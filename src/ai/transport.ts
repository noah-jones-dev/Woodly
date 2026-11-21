/**
 * Secure transport for AI requests.
 *
 * Desktop (Tauri): the request is handed to the Rust `ai_fetch` command,
 * which loads the API key from the OS credential manager (Keychain /
 * Credential Manager / Secret Service), adds the auth header, and only talks
 * to that provider's official host. The key never enters JavaScript.
 *
 * Browser dev mode (`npm run dev` without Tauri): there is no keychain, so
 * the key is held in sessionStorage for the tab's lifetime and added here.
 * That mode is for development only.
 */
import { isTauri, tauriInvoke } from "@/lib/platform";
import type { ProviderId } from "./types";

const DEV_KEY_PREFIX = "woodly.devkey.";

const AUTH_HEADER: Record<ProviderId, (key: string) => [string, string]> = {
  anthropic: (k) => ["x-api-key", k],
  openai: (k) => ["authorization", `Bearer ${k}`],
  gemini: (k) => ["x-goog-api-key", k],
};

type ProxyResponse = { status: number; headers: Record<string, string>; body: string };

function headersToRecord(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  new Headers(h).forEach((v, k) => (out[k] = v));
  // Never forward whatever placeholder credential the SDK set.
  delete out["x-api-key"];
  delete out["authorization"];
  delete out["x-goog-api-key"];
  return out;
}

/** A `fetch`-compatible function bound to one provider. */
export function secureFetch(provider: ProviderId): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    const headers = headersToRecord(init?.headers);
    const body = typeof init?.body === "string" ? init.body : init?.body ? await new Response(init.body).text() : undefined;

    if (isTauri) {
      const r = await tauriInvoke<ProxyResponse>("ai_fetch", { provider, url, method, headers, body: body ?? null });
      return new Response(r.body, { status: r.status, headers: r.headers });
    }
    const key = sessionStorage.getItem(DEV_KEY_PREFIX + provider);
    if (!key) return new Response(JSON.stringify({ error: { message: "No API key configured" } }), { status: 401 });
    const [hk, hv] = AUTH_HEADER[provider](key);
    if (provider === "anthropic") headers["anthropic-dangerous-direct-browser-access"] = "true";
    return fetch(url, { method, headers: { ...headers, [hk]: hv }, body, signal: init?.signal });
  };
}

export const credentials = {
  async save(provider: ProviderId, key: string) {
    if (isTauri) await tauriInvoke("set_api_key", { provider, key });
    else sessionStorage.setItem(DEV_KEY_PREFIX + provider, key);
  },
  async has(provider: ProviderId): Promise<boolean> {
    if (isTauri) return tauriInvoke<boolean>("has_api_key", { provider });
    return !!sessionStorage.getItem(DEV_KEY_PREFIX + provider);
  },
  async remove(provider: ProviderId) {
    if (isTauri) await tauriInvoke("delete_api_key", { provider });
    else sessionStorage.removeItem(DEV_KEY_PREFIX + provider);
  },
};
