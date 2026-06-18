import { NextResponse } from "next/server";

import { isMockOrderId, isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { order_id?: string };
  const orderId = String(body.order_id ?? "");

  // Pre-gateway: assume every checkout succeeded. Flip PAYMENT_GATEWAY_ENABLED to restore real verify.
  if (!isPaymentGatewayEnabled()) {
    return NextResponse.json({
      valid: true,
      provider: "mock",
      order_id: orderId || "mock_bypass",
    });
  }

  if (!orderId) {
    return NextResponse.json({ valid: false, error: "order_id_required" }, { status: 400 });
  }

  if (isMockOrderId(orderId)) {
    return NextResponse.json({ valid: true, provider: "mock" });
  }

  // TODO: verify against real payment provider when PAYMENT_GATEWAY_ENABLED is true.
  return NextResponse.json({ valid: false, error: "payment_not_found" }, { status: 404 });
}
