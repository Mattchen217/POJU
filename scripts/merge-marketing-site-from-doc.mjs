import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mdPath = path.join(root, "docs", "POJU_Fix_03_LLM_Multilang.md");
const md = fs.readFileSync(mdPath, "utf8");

function extract(locale) {
  const header = `## messages/${locale}.json`;
  const idx = md.indexOf(header);
  if (idx === -1) throw new Error(`Missing header ${header}`);
  const startFence = md.indexOf("```json", idx);
  if (startFence === -1) throw new Error(`No json fence after ${header}`);
  const contentStart = md.indexOf("\n", startFence) + 1;
  const endFence = md.indexOf("\n```", contentStart);
  if (endFence === -1) throw new Error(`No closing fence for ${locale}`);
  const jsonStr = md.slice(contentStart, endFence);
  return JSON.parse(jsonStr);
}

for (const loc of ["en", "zh", "es", "fr", "de"]) {
  const part5 = extract(loc);
  const msgPath = path.join(root, "messages", `${loc}.json`);
  const cur = JSON.parse(fs.readFileSync(msgPath, "utf8"));
  cur.marketingSite = part5;
  fs.writeFileSync(msgPath, `${JSON.stringify(cur, null, 2)}\n`);
  console.log("merged", loc, Object.keys(part5));
}
