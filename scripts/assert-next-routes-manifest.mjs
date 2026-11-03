/**
 * Fail loudly if Next left no routes-manifest (Vercel NEXT_NO_ROUTES_MANIFEST symptom).
 * Runs as package.json postbuild so a silent incomplete build cannot look "green".
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const manifest = path.join(process.cwd(), ".next", "routes-manifest.json");
if (!existsSync(manifest)) {
  console.error(
    `[assert-next-routes-manifest] missing ${manifest}\n` +
      "Next build did not produce routes-manifest.json. " +
      "On Vercel this surfaces as NEXT_NO_ROUTES_MANIFEST — check the build log " +
      "above for the real compile/OOM failure, and redeploy with Build Cache disabled. " +
      "Also ensure Project Settings → Output Directory is empty (default).",
  );
  process.exit(1);
}
const size = statSync(manifest).size;
if (size < 32) {
  console.error(
    `[assert-next-routes-manifest] ${manifest} looks empty (${size} bytes)`,
  );
  process.exit(1);
}
console.log(
  `[assert-next-routes-manifest] ok ${path.relative(process.cwd(), manifest)} (${size} bytes)`,
);
