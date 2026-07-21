import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  clearUnmarkedCandidates,
  readUnmarkedCandidates,
  removeUnmarkedCandidate,
} from "@/lib/base-analysis-v2/collect-unmarked";
import { OPS_COOKIE_NAME, verifyOpsSessionToken } from "@/lib/ops/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireOps(): Promise<NextResponse | null> {
  const jar = await cookies();
  if (!verifyOpsSessionToken(jar.get(OPS_COOKIE_NAME)?.value)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await requireOps();
  if (denied) return denied;

  try {
    const data = await readUnmarkedCandidates();
    const entries = Object.entries(data)
      .map(([word, count]) => ({ word, count: Number(count) || 0 }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "zh"));
    return NextResponse.json({ ok: true, entries, total: entries.length });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "kv_read_failed",
      },
      { status: 500 },
    );
  }
}

/** Body: `{ word: "…" }` remove one, or `{ clearAll: true }` wipe pool. */
export async function POST(req: Request) {
  const denied = await requireOps();
  if (denied) return denied;

  let body: { word?: string; clearAll?: boolean };
  try {
    body = (await req.json()) as { word?: string; clearAll?: boolean };
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  try {
    if (body.clearAll) {
      await clearUnmarkedCandidates();
      return NextResponse.json({ ok: true, entries: [], total: 0 });
    }
    if (typeof body.word === "string" && body.word.trim()) {
      const data = await removeUnmarkedCandidate(body.word.trim());
      const entries = Object.entries(data)
        .map(([word, count]) => ({ word, count: Number(count) || 0 }))
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "zh"));
      return NextResponse.json({ ok: true, entries, total: entries.length });
    }
    return NextResponse.json({ ok: false, error: "need_word_or_clearAll" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "kv_write_failed",
      },
      { status: 500 },
    );
  }
}
