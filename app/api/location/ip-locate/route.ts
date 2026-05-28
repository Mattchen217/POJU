import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";

  const url = userIp ? `https://ipapi.co/${userIp}/json/` : "https://ipapi.co/json/";

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return NextResponse.json({ error: "ip_lookup_failed" }, { status: 502 });
    }

    const data = (await res.json()) as {
      city?: string;
      region?: string;
      country_name?: string;
      latitude?: number;
      longitude?: number;
      error?: boolean;
      reason?: string;
    };

    if (data.error || !data.city || !data.country_name) {
      return NextResponse.json(
        { error: data.reason ?? "ip_lookup_incomplete" },
        { status: 422 },
      );
    }

    return NextResponse.json({
      city: data.city,
      region: data.region,
      country_name: data.country_name,
      latitude: data.latitude,
      longitude: data.longitude,
    });
  } catch (e) {
    console.error("[location/ip-locate]", e);
    return NextResponse.json({ error: "ip_lookup_error" }, { status: 500 });
  }
}
