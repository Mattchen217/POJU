import { NextResponse } from "next/server";
import { isMockPaymentId, POJU_SESSION_PRICE_USD } from "@/lib/poju/session-payment";

export const runtime = "nodejs";

export type RefundReason = "user_declined_profile" | "unsatisfied" | "other";

interface RefundRequest {
  session_id: string;
  payment_id: string;
  payment_processor: "dodopayments" | "stripe";
  reason: RefundReason;
}

function invalidBody(message: string) {
  return NextResponse.json({ success: false, error: message, fallback: "support@pojulife.com" }, { status: 400 });
}

async function refundViaDodoPayments(req: RefundRequest): Promise<{ refund_id: string; amount: number }> {
  const apiKey = process.env.DODO_API_KEY;
  if (!apiKey) throw new Error("DodoPayments not configured");

  const response = await fetch("https://api.dodopayments.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payment_id: req.payment_id,
      reason: req.reason,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DodoPayments refund failed: ${error}`);
  }

  const data = (await response.json()) as { id?: string; amount?: number };
  return {
    refund_id: String(data.id ?? `dodo_refund_${Date.now()}`),
    amount: typeof data.amount === "number" ? data.amount : POJU_SESSION_PRICE_USD,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<RefundRequest>;
    const session_id = String(body.session_id ?? "").trim();
    const payment_id = String(body.payment_id ?? "").trim();
    const payment_processor = body.payment_processor;
    const reason = body.reason ?? "user_declined_profile";

    if (!session_id || !payment_id) {
      return invalidBody("session_id and payment_id are required");
    }
    if (payment_processor !== "dodopayments" && payment_processor !== "stripe") {
      return invalidBody("Unsupported payment_processor");
    }

    if (isMockPaymentId(payment_id)) {
      return NextResponse.json({
        success: true,
        refund_id: `mock_refund_${Date.now()}`,
        amount: POJU_SESSION_PRICE_USD,
        eta_days: 3,
        mock: true,
      });
    }

    if (payment_processor === "dodopayments") {
      const refundResult = await refundViaDodoPayments({
        session_id,
        payment_id,
        payment_processor,
        reason,
      });
      return NextResponse.json({
        success: true,
        refund_id: refundResult.refund_id,
        amount: refundResult.amount,
        eta_days: 5,
      });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Stripe not configured",
          fallback: "support@pojulife.com",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Stripe refund integration pending",
        fallback: "support@pojulife.com",
      },
      { status: 501 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[refund] Failed:", message);
    return NextResponse.json(
      {
        success: false,
        error: message,
        fallback: "support@pojulife.com",
      },
      { status: 500 },
    );
  }
}
