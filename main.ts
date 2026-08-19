import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/config.js") {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const jsContent = `
      window.SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
      window.SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};
    `;

    return new Response(jsContent, {
      status: supabaseUrl && supabaseAnonKey ? 200 : 503,
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache"
      },
    });
  }

  return serveDir(req, {
    fsRoot: ".",
    showIndex: true,
  });
});
