const home = await fetch("https://www.easternos.com/");
const homeText = await home.text();
const build = homeText.match(/"b":"([^"]+)"/);
console.log(
  JSON.stringify({
    home_status: home.status,
    build_id: build?.[1] ?? null,
  }),
);

const ops = await fetch("https://www.easternos.com/api/ops/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "x", password: "y" }),
});
console.log(
  JSON.stringify({
    ops_login_status: ops.status,
    ops_login_body: await ops.text(),
  }),
);

const inngest = await fetch("https://www.easternos.com/api/inngest");
console.log(
  JSON.stringify({
    inngest_status: inngest.status,
    inngest_handled: inngest.headers.get("x-inngest-sdk-handled"),
    inngest_body: (await inngest.text()).slice(0, 120),
  }),
);

const chat = await fetch("https://www.easternos.com/api/poju/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({}),
});
console.log(
  JSON.stringify({
    chat_status: chat.status,
    chat_body: (await chat.text()).slice(0, 200),
  }),
);
