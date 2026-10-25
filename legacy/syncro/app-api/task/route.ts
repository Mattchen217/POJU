import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { task?: string };
  const task = String(body.task ?? "General alignment");
  const lines = Array.from({ length: 40 }, (_, i) => `${i + 1}. ${task} insight ${i + 1}`);
  return NextResponse.json({
    ok: true,
    task,
    generatedAt: Date.now(),
    validWindowHours: "9-11",
    lines,
  });
}
