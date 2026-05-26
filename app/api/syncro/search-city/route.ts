import { NextResponse } from "next/server";
import { mapNominatimResults } from "@/lib/syncro/nominatim-search";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
        q: query,
        format: "json",
        limit: "8",
        "accept-language": "zh,en",
      })}`,
      {
        headers: {
          "User-Agent": "pojulife/1.0 (https://pojulife.com)",
        },
        next: { revalidate: 0 },
      },
    );

    if (!response.ok) {
      return NextResponse.json({ error: "search_failed" }, { status: 500 });
    }

    const data = (await response.json()) as Parameters<typeof mapNominatimResults>[0];
    return NextResponse.json({ results: mapNominatimResults(data) });
  } catch (e) {
    console.error("[search-city] error", e);
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
