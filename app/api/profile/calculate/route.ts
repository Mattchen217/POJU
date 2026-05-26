import { NextResponse } from "next/server";
import { calculateProfile } from "@/lib/calculations";
import { normalizeBirthInfoInput } from "@/lib/profile/normalize-birth-input";
import type { BirthInfoInput } from "@/lib/profile/normalize-birth-input";

type CalculateBody = BirthInfoInput & {
  use_defaults?: boolean;
  user_timezone?: string;
};

function missingLocation(body: CalculateBody): boolean {
  if (body.use_defaults) return false;
  const raw = body as Record<string, unknown>;
  if (raw.birth_location && typeof raw.birth_location === "object") {
    const bl = raw.birth_location as Record<string, unknown>;
    return typeof bl.longitude !== "number";
  }
  return raw.longitude == null || !Number.isFinite(Number(raw.longitude));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CalculateBody;

    if (!body.use_defaults && missingLocation(body)) {
      return NextResponse.json({ ok: false, error: "invalid_location" }, { status: 400 });
    }

    const input = normalizeBirthInfoInput(body);
    const profile = await calculateProfile(input);

    return NextResponse.json({
      ok: true,
      profile,
      tst_meta: profile.tst_meta,
      used_true_solar_time: profile.used_true_solar_time ?? false,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to calculate profile" },
      { status: 500 },
    );
  }
}
