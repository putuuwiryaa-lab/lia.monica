// Run from the repository root: deno test --allow-read --allow-env tests/
import assert from "node:assert/strict";
import { createContext, runInContext } from "node:vm";

const source = await Deno.readTextFile("user4/app.js");
const context = createContext({
  document: {
    getElementById: () => ({ style: {}, addEventListener() {} }),
    createElement: () => ({}),
    head: { appendChild() {} },
  },
  AbortController,
  setTimeout,
  clearTimeout,
  fetch: () => Promise.resolve(new Response("[]")),
});
runInContext(source, context);
// Let the normal market-loading bootstrap finish before the test sanitizer runs.
await new Promise((resolve) => setTimeout(resolve, 0));
function evaluate(expression: string) {
  return JSON.parse(JSON.stringify(runInContext(expression, context)));
}

Deno.test("APM uses the latest three results in newest-first positional order", () => {
  const result = evaluate('runAPM4D(["8901", "5678", "3456"])');
  assert.deepEqual(result.projections, [1, 2, 6, 7]);
  assert.deepEqual(result.scores, [1, 4, 4, 1, 0, 1, 4, 4, 1, 0]);
  assert.equal(result.digits.join(""), "0123567");
  assert.deepEqual(evaluate('runAPM4D(["8901", "5678", "3456", "9999"])'), result);
});

Deno.test("APM rounds and wraps correctly for all 1,000 single-position histories", () => {
  for (let current = 0; current < 10; current++) {
    for (let previous = 0; previous < 10; previous++) {
      for (let older = 0; older < 10; older++) {
        const weighted = 7 * (current - previous) + 3 * (previous - older);
        const expected = ((current + Math.floor((weighted + 5) / 10)) % 10 + 10) % 10;
        const hist = [current, previous, older].map((n) => String(n).repeat(4));
        const result = evaluate(`runAPM4D(${JSON.stringify(hist)})`);
        assert.deepEqual(result.projections, Array(4).fill(expected), hist.join(","));
        assert.equal(result.digits.length, 7);
        assert.equal(new Set(result.digits).size, 7);
        assert.ok(result.digits.every((digit: number) => digit >= 0 && digit <= 9));
      }
    }
  }
});

Deno.test("proximity accumulates repeated projections, wraps neighbors, and breaks ties", () => {
  const result = evaluate('runAPM4D(["0000", "0000", "0000"])');
  assert.deepEqual(result.scores, [12, 4, 0, 0, 0, 0, 0, 0, 0, 4]);
  assert.equal(result.digits.join(""), "0123459");
  assert.equal(evaluate('runAPM4D(["1357", "1357", "1357"]).digits.join("")'), "1234567");
});

Deno.test("history preserves leading zeroes and accepts the existing backend formats", () => {
  assert.deepEqual(evaluate('history([{result: "0012"}, 34, "5678"], "0012")'), ["0012", "0034", "5678"]);
  assert.deepEqual(evaluate('history(\'["8901","5678","3456"]\', null)'), ["8901", "5678", "3456"]);
  assert.deepEqual(evaluate('history("8901\\n5678\\n3456", null)'), ["8901", "5678", "3456"]);
});

Deno.test("fewer than three valid results never produce a prediction or duplicate last_result", () => {
  for (const hist of [[], ["0000"], ["0000", "0000"]]) {
    assert.equal(evaluate(`runAPM4D(${JSON.stringify(hist)})`), null);
  }
  assert.deepEqual(evaluate('history(["", " ", null, "bad", "12345", "12.3", "-1"], null)'), []);
  assert.deepEqual(evaluate('history(null, 12)'), ["0012"]);
  assert.deepEqual(evaluate('history(["1234", "5678"], "1234")'), ["1234", "5678"]);
  assert.equal(evaluate('runAPM4D(history(["", "1234", "5678"], "1234"))'), null);
});

Deno.test("user4 HTML matches user3 apart from its script URL", async () => {
  const user3 = await Deno.readTextFile("user3/index.html");
  const user4 = await Deno.readTextFile("user4/index.html");
  assert.equal(user4.replace("/user4/app.js", "/user3/app.js"), user3);
});

Deno.test("login, session, health, and routes support user4 while retaining users 1–3", async (test) => {
  const config: Record<string, string> = {
    LOGIN_SESSION_SECRET: "test-only-session-secret",
    MASTER_PIN: "test-only-master-pin",
    LOGIN_PASS1: "test-only-pass1",
    LOGIN_PASS2: "test-only-pass2",
    LOGIN_PASS3: "test-only-pass3",
    LOGIN_PASS4: "test-only-pass4",
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: "",
  };
  const saved = Object.fromEntries(Object.keys(config).map((key) => [key, Deno.env.get(key)]));
  const serve = Deno.serve;
  let handler: (req: Request) => Promise<Response>;
  // Capture the real server handler without binding a port or contacting Supabase.
  Deno.serve = ((callback: typeof handler) => { handler = callback; }) as typeof Deno.serve;
  let requestNumber = 0;
  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("x-forwarded-for", `test-${++requestNumber}`);
    return await handler(new Request(`https://example.test${path}`, { ...init, headers }));
  }
  async function login(user: string, password: string) {
    return await request("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user, password }),
    });
  }
  try {
    for (const [key, value] of Object.entries(config)) Deno.env.set(key, value);
    await import("../main.ts");
    Deno.serve = serve;
    const cookies: Record<string, string> = {};
    for (const user of ["user1", "user2", "user3", "user4"]) {
      await test.step(`${user} login and page remain functional`, async () => {
        const response = await login(user, `test-only-pass${user.slice(-1)}`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true, user, redirect: `/${user}/` });
        const cookie = response.headers.get("set-cookie")!;
        assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
        cookies[user] = cookie.split(";")[0];
        const page = await request(`/${user}/`, { headers: { cookie: cookies[user] } });
        assert.equal(page.status, 200);
        const expectedPath = user === "user1" ? "index.html" : `${user}/index.html`;
        assert.equal(await page.text(), await Deno.readTextFile(expectedPath));
      });
    }
    await test.step("user4 rejects invalid credentials and accepts the existing master PIN", async () => {
      assert.equal((await login("user4", "wrong")).status, 401);
      assert.equal((await login("user4", "")).status, 401);
      assert.equal((await login("user5", "test-only-master-pin")).status, 401);
      const response = await login("user4", "test-only-master-pin");
      assert.equal(response.status, 200);
      assert.equal((await response.json()).redirect, "/user4/");
    });
    await test.step("all user4 page URLs require the matching session", async () => {
      for (const path of ["/user4", "/user4/", "/user4/index.html"]) {
        const anonymous = await request(path);
        assert.equal(anonymous.status, 302);
        assert.equal(anonymous.headers.get("location"), "/login.html");
        for (const user of ["user1", "user2", "user3"]) {
          const other = await request(path, { headers: { cookie: cookies[user] } });
          assert.equal(other.status, 302);
          assert.equal(other.headers.get("location"), `/${user}/`);
        }
        const page = await request(path, { headers: { cookie: cookies.user4 } });
        assert.equal(page.status, 200);
        assert.match(await page.text(), /src="\/user4\/app.js"/);
      }
      const root = await request("/", { headers: { cookie: cookies.user4 } });
      assert.equal(root.headers.get("location"), "/user4/");
      const session = await request("/api/session", { headers: { cookie: cookies.user4 } });
      assert.deepEqual(await session.json(), { ok: true, user: "user4" });
      for (const user of ["user1", "user2", "user3"]) {
        const response = await request(`/${user}/`, { headers: { cookie: cookies.user4 } });
        assert.equal(response.headers.get("location"), "/user4/");
      }
      const script = await request("/user4/app.js");
      assert.equal(script.status, 200);
      assert.equal(await script.text(), source);
    });
    await test.step("health requires LOGIN_PASS4 and an unset password cannot authenticate", async () => {
      assert.equal((await (await request("/api/health")).json()).auth_configured, true);
      Deno.env.delete("LOGIN_PASS4");
      assert.equal((await (await request("/api/health")).json()).auth_configured, false);
      assert.equal((await login("user4", "test-only-pass4")).status, 401);
      Deno.env.set("LOGIN_PASS4", config.LOGIN_PASS4);
    });
  } finally {
    Deno.serve = serve;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});
