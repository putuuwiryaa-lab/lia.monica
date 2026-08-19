import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 60;
const requests = new Map<string, { count: number; reset: number }>();

function securityHeaders(extra: Record<string, string> = {}) {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "content-security-policy": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
    ...extra,
  };
}

function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0]?.trim() || "unknown").slice(0, 100);
}

function rateLimited(req: Request) {
  const now = Date.now();
  const key = clientIp(req);
  const current = requests.get(key);
  if (!current || now >= current.reset) {
    requests.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }
  current.count++;
  return current.count > RATE_LIMIT;
}

async function supabaseGet(path: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Backend Supabase configuration is missing.");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}).`);
  return body ? JSON.parse(body) : [];
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: securityHeaders(extra) });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: securityHeaders({ "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "Content-Type" }) });
  }

  if (rateLimited(req)) {
    return json({ error: "Too many requests. Try again later." }, 429, { "retry-after": "60" });
  }

  if (url.pathname === "/api/markets" && req.method === "GET") {
    try {
      const markets = await supabaseGet("markets?select=id,name,order&order=order.asc");
      return json(markets);
    } catch (error) {
      console.error(error);
      return json({ error: "Failed to load markets." }, 502);
    }
  }

  if (url.pathname.startsWith("/api/markets/") && req.method === "GET") {
    const id = decodeURIComponent(url.pathname.slice("/api/markets/".length));
    if (!id || id.length > 120) return json({ error: "Invalid market id." }, 400);
    try {
      const markets = await supabaseGet(`markets?select=id,name,history_data,last_result&id=eq.${encodeURIComponent(id)}&limit=1`);
      if (!Array.isArray(markets) || markets.length === 0) return json({ error: "Market not found." }, 404);
      return json(markets[0]);
    } catch (error) {
      console.error(error);
      return json({ error: "Failed to load market." }, 502);
    }
  }

  if (url.pathname === "/config.js") {
    return new Response("window.SUPABASE_URL=undefined;window.SUPABASE_ANON_KEY=undefined;", {
      status: 200,
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }

  const response = await serveDir(req, { fsRoot: ".", showIndex: true });
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
  return new Response(response.body, { status: response.status, headers });
});
