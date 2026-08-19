 
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Endpoint injeksi konfigurasi ke frontend
  if (url.pathname === "/config.js") {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    const jsContent = `
      window.SUPABASE_URL = "${supabaseUrl}";
      window.SUPABASE_ANON_KEY = "${supabaseAnonKey}";
    `;

    return new Response(jsContent, {
      headers: { 
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store"
      },
    });
  }

  // Melayani file statis (index.html)
  return serveDir(req, {
    fsRoot: ".",
    showIndex: true,
  });
});
