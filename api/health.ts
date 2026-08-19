export default function handler(_req: Request) {
  const configured = Boolean(Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_ANON_KEY"));
  return new Response(JSON.stringify({ ok: true, supabase_configured: configured }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}
