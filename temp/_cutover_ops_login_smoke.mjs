const res = await fetch("https://www.easternos.com/api/ops/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "x", password: "y" }),
});
const text = await res.text();
console.log(
  JSON.stringify({
    status: res.status,
    body: text.slice(0, 200),
  }),
);
