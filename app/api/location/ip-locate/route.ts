import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";

  const url = userIp ? `https://ipapi.co/${userIp}/json/` : "https://ipapi.co/json/";

  // 地理预填是非关键功能：查不到就让前端回退到手动选择，绝不 502/500 报错阻塞。
  // 统一返回 200，用 { located: false } 告诉前端"没查到，走手动"，不当错误处理。
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000); // 免费库慢，3s 超时即放弃
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return NextResponse.json({ located: false, reason: "lookup_unavailable" }, { status: 200 });
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
        { located: false, reason: data.reason ?? "incomplete" },
        { status: 200 },
      );
    }
    return NextResponse.json({
      located: true,
      city: data.city,
      region: data.region,
      country_name: data.country_name,
      latitude: data.latitude,
      longitude: data.longitude,
    });
  } catch (e) {
    // 超时/网络错误也是"没查到"，不是服务器错误。debug 级日志，不刷 error。
    console.debug("[location/ip-locate] soft-fail:", (e as Error)?.name ?? e);
    return NextResponse.json({ located: false, reason: "lookup_error" }, { status: 200 });
  }
}
