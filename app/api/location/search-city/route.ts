import { NextResponse } from "next/server";

import { mapNominatimCityResults } from "@/lib/location/nominatim-city-search";

export const runtime = "nodejs";

const NOMINATIM_HEADERS = { "User-Agent": "pojulife/1.0 (birth-location)" };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
        q,
        format: "json",
        limit: "8",
        featuretype: "city",
        "accept-language": "en",
      })}`,
      { headers: NOMINATIM_HEADERS, next: { revalidate: 3600 } },
    );

    if (!res.ok) {
      return NextResponse.json({ error: "search_failed" }, { status: 502 });
    }

    const data = (await res.json()) as Parameters<typeof mapNominatimCityResults>[0];
    return NextResponse.json({ results: mapNominatimCityResults(data) });
  } catch (e) {
    console.error("[location/search-city]", e);
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
