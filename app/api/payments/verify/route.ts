import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { order_id?: string };
  const orderId = String(body.order_id ?? "");
  if (!orderId) {
    return NextResponse.json({ valid: false, error: "order_id_required" }, { status: 400 });
  }
  if (orderId.startsWith("mockpoju_") || orderId.startsWith("mock-")) {
    return NextResponse.json({ valid: true, provider: "mock" });
  }
  return NextResponse.json({ valid: false, error: "payment_not_found" }, { status: 404 });
}
