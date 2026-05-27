/**
 * Step 1.3 — replace decorative `border:` in styles/*.css with inset box-shadow / outline.
 * Skips pojulife-design-system.css (intentional reset).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const stylesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "styles");

for (const file of fs.readdirSync(stylesDir)) {
  if (!file.endsWith(".css") || file === "pojulife-design-system.css") continue;
  const filePath = path.join(stylesDir, file);
  let s = fs.readFileSync(filePath, "utf8");
  const orig = s;

  s = s.replace(/border:\s*1px\s+solid\s+([^;]+);/gi, "box-shadow: inset 0 0 0 0.5px $1;");
  s = s.replace(/border:\s*2px\s+solid\s+([^;]+);/gi, "box-shadow: inset 0 0 0 1px $1;");
  s = s.replace(/border:\s*3px\s+solid\s+([^;]+);/gi, "box-shadow: inset 0 0 0 1.5px $1;");
  s = s.replace(/border:\s*2px\s+dashed\s+([^;]+);/gi, "outline: 1px dashed $1; outline-offset: -1px;");
  s = s.replace(/border:\s*1px\s+dashed\s+([^;]+);/gi, "outline: 1px dashed $1; outline-offset: -1px;");
  s = s.replace(/border-color:\s*([^;]+);/gi, "/* border-color removed (Step 1) */");
  s = s.replace(/border:\s*var\(--glass-card-border\);/gi, "/* glass border → shadow via .glass-card */");
  s = s.replace(/border:\s*var\(--glass-input-border\);/gi, "box-shadow: var(--glass-input-edge);");
  s = s.replace(/border:\s*var\(--glass-nav-border\);/gi, "box-shadow: var(--glass-nav-edge);");
  s = s.replace(/border:\s*var\(--glass-section-border\);/gi, "");

  if (s !== orig) {
    fs.writeFileSync(filePath, s);
    console.log("updated:", file);
  }
}

console.log("done");
