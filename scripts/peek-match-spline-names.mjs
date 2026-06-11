import fs from "node:fs";

const buf = fs.readFileSync("public/spline/Match.splinecode");
const text = buf.toString("latin1");
const ascii = [...text.matchAll(/[\x20-\x7e]{4,60}/g)].map((m) => m[0]);
const unique = [...new Set(ascii)].filter((s) =>
  /camera|Camera|orbit|Orbit|personal|zoom|distance|ortho|fov/i.test(s),
);
console.log("count", unique.length);
console.log(unique.join("\n"));
