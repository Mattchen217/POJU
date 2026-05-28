import { NextResponse } from "next/server";

export const runtime = "nodejs";

const NOMINATIM_HEADERS = { "User-Agent": "pojulife/1.0 (birth-location)" };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "missing_coords" }, { status: 400 });
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return NextResponse.json({ error: "invalid_coords" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lngNum}&format=json&accept-language=en`,
      { headers: NOMINATIM_HEADERS, next: { revalidate: 86400 } },
    );

    if (!res.ok) {
      return NextResponse.json({ error: "geocode_failed" }, { status: 502 });
    }

    const data = (await res.json()) as { address?: Record<string, string> };
    const addr = data.address ?? {};
    const city =
      addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.state;

    if (!city || !addr.country) {
      return NextResponse.json({ error: "geocode_incomplete" }, { status: 422 });
    }

    return NextResponse.json({
      city,
      state: addr.state,
      country: addr.country,
    });
  } catch (e) {
    console.error("[location/reverse-geocode]", e);
    return NextResponse.json({ error: "geocode_error" }, { status: 500 });
  }
}
