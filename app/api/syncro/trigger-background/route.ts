import { NextRequest, NextResponse } from "next/server";

import { inngest } from "@/lib/inngest/client";
import { buildHourPairsFromLive } from "@/lib/syncro/syncro-hour-pairs";
import { setSyncroLlmContextKv } from "@/lib/syncro/syncro-llm-context-kv";
import { setSyncroStatus } from "@/lib/syncro/syncro-status-kv";
import type { SyncroLlmContext } from "@/lib/syncro/syncro-llm-context-storage";
import type { HourPeriod } from "@/lib/syncro/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  session_id: string;
  live_period: HourPeriod;
  llm_context: SyncroLlmContext;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const session_id = body.session_id?.trim();
  const live_period = body.live_period;
  if (!session_id || !live_period || !body.llm_context) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await setSyncroLlmContextKv(session_id, body.llm_context);

  const pairs = buildHourPairsFromLive(live_period);
  const hour_order = pairs.flatMap((p) => [p[0], p[1]]);

  await setSyncroStatus(session_id, {
    total: 12,
    completed: 2,
    current_hour: pairs[1]?.[0] ?? null,
    failed_hours: [],
    hour_order,
    started_at: Date.now(),
    updated_at: Date.now(),
    done: false,
  });

  try {
    await inngest.send({
      name: "syncro/generate-remaining",
      data: { session_id, live_period },
    });
  } catch (e) {
    console.error("[trigger-background] inngest.send failed:", e);
    return NextResponse.json({ error: "inngest_send_failed" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, remaining_pairs: pairs.length - 1 });
}
