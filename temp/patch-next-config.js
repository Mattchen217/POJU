const fs = require("fs");
const p = "D:/POJU/pojulife/next.config.mjs";
let s = fs.readFileSync(p, "utf8");
if (s.includes('source: "/register"')) {
  console.log("already");
  process.exit(0);
}
const needle = "      {\r\n        source: \"/oracle\",\r\n        destination: \"/glyph\",\r\n        permanent: true,\r\n      },";
const insert =
  "      {\r\n        source: \"/register\",\r\n        destination: \"/signup\",\r\n        permanent: false,\r\n      },\r\n" +
  "      {\r\n        source: \"/:locale(zh|es|fr)/register\",\r\n        destination: \"/:locale/signup\",\r\n        permanent: false,\r\n      },\r\n" +
  needle;
if (!s.includes(needle)) {
  console.log("still missing");
  process.exit(1);
}
fs.writeFileSync(p, s.replace(needle, insert));
console.log("ok");
