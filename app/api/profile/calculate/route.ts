import { NextResponse } from "next/server";
import { calculateProfile } from "@/lib/calculations";
import { normalizeBirthInfoInput } from "@/lib/profile/normalize-birth-input";
import type { BirthInfo } from "@/lib/profile/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<BirthInfo>;
    const input = normalizeBirthInfoInput(body);
    const profile = await calculateProfile(input);
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to calculate profile" },
      { status: 500 },
    );
  }
}
