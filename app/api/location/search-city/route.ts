import { NextResponse } from "next/server";

import { hitsToBirthSuggestions, searchCities } from "@/lib/location/search-city-engine";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const hits = await searchCities(q, { acceptLanguage: "en" });
    return NextResponse.json({ results: hitsToBirthSuggestions(hits) });
  } catch (e) {
    console.error("[location/search-city]", e);
    return NextResponse.json({ error: "search_failed", results: [] }, { status: 502 });
  }
}
