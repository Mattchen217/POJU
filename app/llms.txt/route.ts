import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

/**
 * Serve /llms.txt as text/plain even if a host rewrite would otherwise
 * fall through to the HTML marketing shell (Lighthouse / AI agents).
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "llms.txt");
    const body = await readFile(filePath, "utf8");
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("# Eastern OS\n\n> Decision support. You decide.\n", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
