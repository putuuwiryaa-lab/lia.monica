const enc = new TextEncoder();

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function checkPassword(input: string, expected: string | undefined): Promise<boolean> {
  if (!expected) return false;
  return equalBytes(await digest(input), await digest(expected));
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      ...headers,
    },
  });
}

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405, { allow: "POST" });
  }

  try {
    const body = await req.json();
    const user = String(body?.user || "").toLowerCase();
    const password = String(body?.password || "");

    const passwords: Record<string, string | undefined> = {
      user1: Deno.env.get("USER1_PASSWORD"),
      user2: Deno.env.get("USER2_PASSWORD"),
    };

    if (!(user in passwords) || !password || !(await checkPassword(password, passwords[user]))) {
      return json({ ok: false, error: "Username atau password salah." }, 401);
    }

    const redirect = user === "user2" ? "/user2/" : "/";
    const tokenPayload = `${user}:${Date.now()}`;
    const token = btoa(tokenPayload);

    return json(
      { ok: true, redirect },
      200,
      {
        "set-cookie": `lia_user=${encodeURIComponent(token)}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Strict`,
      },
    );
  } catch {
    return json({ ok: false, error: "Permintaan login tidak valid." }, 400);
  }
}
