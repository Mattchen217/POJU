const fs = require("fs");
const p = "scripts/test-decision-context-phase3-idb.ts";
let s = fs.readFileSync(p, "utf8");

// Remove boot probe
s = s.replace(
  /\n  const __fs = await import\("node:fs"\);\n  __fs\.writeFileSync\("temp\/c5-boot\.txt", "booted " \+ Date\.now\(\)\);\n  console\.log\("C5_BOOT_PROBE"\);/,
  "",
);

if (!s.includes("main().catch")) {
  if (!s.trimEnd().endsWith("}")) {
    throw new Error("unexpected ending: " + JSON.stringify(s.slice(-80)));
  }
  s =
    s.trimEnd() +
    `

main().catch((err) => {
  console.error(err);
  summarize("phase3-s5-idb");
  process.exit(1);
});
`;
  console.log("restored main().catch");
} else {
  console.log("main().catch already present");
}

fs.writeFileSync(p, s);
console.log("tail ok", s.slice(-200));
