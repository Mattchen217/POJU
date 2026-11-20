const base = "https://www.easternos.com";

async function probe(name, init) {
  const res = await fetch(`${base}${init.path}`, {
    method: init.method || "GET",
    headers: init.headers,
    body: init.body,
  });
  const text = await res.text();
  return {
    name,
    status: res.status,
    headers: {
      inngest: res.headers.get("x-inngest-sdk-handled"),
      matched: res.headers.get("x-matched-path"),
      vercel_id: res.headers.get("x-vercel-id"),
    },
    body: text.slice(0, 240),
  };
}

const results = [];
results.push(await probe("home", { path: "/" }));
results.push(
  await probe("app_entry", {
    path: "/app",
    method: "GET",
  }),
);
results.push(
  await probe("chat_empty", {
    path: "/api/poju/chat",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  }),
);
results.push(
  await probe("inngest", {
    path: "/api/inngest",
  }),
);
results.push(
  await probe("ops_login_configured", {
    path: "/api/ops/login",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "x", password: "y" }),
  }),
);

// Minimal DI2 session shell — expect validation or turn handling, not MemoryKv.
const sessionId = crypto.randomUUID();
const minimalSession = {
  id: sessionId,
  messages: [],
  phase: "opening",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
results.push(
  await probe("chat_minimal_session", {
    path: "/api/poju/chat",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session: minimalSession,
      message: "cutover smoke — ignore",
      locale: "en",
    }),
  }),
);

console.log(JSON.stringify({ ok: true, results }, null, 2));
