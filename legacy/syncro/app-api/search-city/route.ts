import { NextResponse } from "next/server";

import { hitsToSyncroResults, searchCities } from "@/lib/location/search-city-engine";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const hits = await searchCities(query, { acceptLanguage: "zh,en" });
    return NextResponse.json({ results: hitsToSyncroResults(hits) });
  } catch (e) {
    console.error("[search-city] error", e);
    return NextResponse.json({ error: "search_failed", results: [] }, { status: 500 });
  }
}
