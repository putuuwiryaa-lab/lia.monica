const enc = new TextEncoder();
const sessions = new Map<string, { user: string; expires: number }>();

function json(data: unknown, status = 200, headers: Record<string,string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store", "x-content-type-options":"nosniff", "x-frame-options":"DENY", "referrer-policy":"strict-origin-when-cross-origin", ...headers } });
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2,"0")).join("");
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return json({ ok:false, error:"Method not allowed" }, 405, { allow:"POST" });
  try {
    const body = await req.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    if (!username || !password) return json({ ok:false, error:"Username dan password wajib diisi." }, 400);

    const users: Record<string,string> = {
      [Deno.env.get("LOGIN_USER1") || ""]: Deno.env.get("LOGIN_PASS1") || "",
      [Deno.env.get("LOGIN_USER2") || ""]: Deno.env.get("LOGIN_PASS2") || "",
    };
    const expected = users[username];
    if (!expected || password.length > 256 || password !== expected) return json({ ok:false, error:"Username atau password salah." }, 401);

    const token = crypto.randomUUID();
    sessions.set(token, { user: username, expires: Date.now() + 8 * 60 * 60 * 1000 });
    return json({ ok:true, redirect:"/" }, 200, { "set-cookie": cookie("lia_session", token, 8 * 60 * 60) });
  } catch {
    return json({ ok:false, error:"Permintaan login tidak valid." }, 400);
  }
}
