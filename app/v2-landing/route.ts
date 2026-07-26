import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve the V2 landing HTML as-is (no React port).
 * Prefers the design file outside the repo, then the in-repo copies.
 */
const CANDIDATES = [
  path.resolve("d:/POJU/v2落地页.html"),
  path.join(process.cwd(), "docs/visual-reference/v2-workspace-landing.html"),
  path.join(process.cwd(), "public/v2-landing.html"),
] as const;

export async function GET() {
  let lastError: unknown;
  for (const filePath of CANDIDATES) {
    try {
      const html = await readFile(filePath, "utf8");
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      lastError = error;
    }
  }

  console.error("[v2-landing] failed to read HTML", lastError);
  return new Response("V2 landing HTML not found.", { status: 404 });
}
