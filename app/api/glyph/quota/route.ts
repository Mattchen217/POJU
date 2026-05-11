import { NextResponse } from "next/server";

type QuotaState = {
  day: string;
  freeUsed: boolean;
  paidCount: number;
};

const store = new Map<string, QuotaState>();

function getKey(req: Request): string {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  return ip.split(",")[0]?.trim() || "local";
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getState(key: string): QuotaState {
  const day = dayKey();
  const current = store.get(key);
  if (!current || current.day !== day) {
    const fresh = { day, freeUsed: false, paidCount: 0 };
    store.set(key, fresh);
    return fresh;
  }
  return current;
}

export async function GET(req: Request) {
  const state = getState(getKey(req));
  return NextResponse.json({
    canUseFree: !state.freeUsed,
    paidCount: state.paidCount,
    day: state.day,
  });
}

export async function POST(req: Request) {
  const key = getKey(req);
  const state = getState(key);
  const body = (await req.json().catch(() => ({}))) as { action?: "consume_free" | "consume_paid" };
  if (body.action === "consume_free") state.freeUsed = true;
  if (body.action === "consume_paid") state.paidCount += 1;
  store.set(key, state);
  return NextResponse.json({ ok: true, state });
}
