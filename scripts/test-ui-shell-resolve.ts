/**
 * Smoke checks for parallel UI shell helpers (no network).
 * Run: pnpm exec tsx scripts/test-ui-shell-resolve.ts
 */
import {
  getWorkspaceHref,
  mapProductHrefForShell,
  parseUiShellValue,
  parseWorkspaceTab,
} from "../lib/ui-shell/resolve-ui-shell";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(parseUiShellValue("workspace") === "workspace", "parse workspace");
assert(parseUiShellValue("classic") === "classic", "parse classic");
assert(parseUiShellValue("app") === "workspace", "parse app alias");
assert(mapProductHrefForShell("/poju", "workspace") === "/app?tab=poju", "remap poju");
assert(mapProductHrefForShell("/match", "workspace") === "/app?tab=match", "remap match");
assert(mapProductHrefForShell("/poju", "classic") === "/poju", "classic unchanged");
assert(getWorkspaceHref("atmos") === "/app?tab=atmos", "atmos href");
assert(parseWorkspaceTab("glyph") === "glyph", "tab glyph");
assert(parseWorkspaceTab("x") === "atmos", "tab default atmos");

console.log("test-ui-shell-resolve: ok");
