import { readFileSync, writeFileSync } from "node:fs";

const path = "lib/glossary/pojulife-terms.ts";
const src = readFileSync(path, "utf8");
const frag = readFileSync("tmp-phase11-terms-fragment.ts", "utf8");
const marker = "  // --- qimen Phase 3 field labels";
const i = src.indexOf(marker);
if (i < 0) {
  console.error("marker not found");
  process.exit(1);
}
if (src.includes("zw_peer_bond_field")) {
  console.error("phase11 terms already present");
  process.exit(1);
}
const out =
  src.slice(0, i) +
  frag +
  (frag.endsWith("\n") ? "" : "\n") +
  src.slice(i);
writeFileSync(path, out);
const nsCount = (out.match(/ns: "ziwei"/g) || []).length;
console.log("spliced ok; ziwei ns count =", nsCount);
