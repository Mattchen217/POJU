import { NextResponse } from "next/server";

type Product = "poju" | "glyph" | "syncro_ar";

function randomToken(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 占位收银台：真实 Dodo 回调后续接入。POJU $9.99 走 /start → /chat?token=… 与 Chat 引导一致。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    product?: string;
    amount?: number;
    device_id?: string;
    return_url?: string;
    /** BCP 47 or short code; used only when `return_url` is omitted (mock checkout path). */
    locale?: string;
  };
  const raw = String(body.product ?? "glyph").toLowerCase();
  const product: Product =
    raw === "poju" ? "poju" : raw === "syncro_ar" || raw === "syncro" ? "syncro_ar" : "glyph";

  const amounts: Record<Product, number> = {
    poju: 9.99,
    glyph: 4.99,
    syncro_ar: 1.99,
  };

  if (product === "poju") {
    const orderId = randomToken("mockpoju");
    const loc =
      typeof body.locale === "string" && /^[a-zA-Z]{2,3}([-_][a-zA-Z0-9]+)*$/.test(body.locale.trim())
        ? body.locale.trim()
        : "en";
    const fallbackReturn = `/${loc}/poju/payment-success?mock=true`;
    const returnUrl = typeof body.return_url === "string" && body.return_url.length > 0 ? body.return_url : fallbackReturn;
    const sep = returnUrl.includes("?") ? "&" : "?";
    const paymentUrl = `${returnUrl}${sep}mock=true&order_id=${encodeURIComponent(orderId)}`;
    return NextResponse.json({
      ok: true,
      product,
      amount: amounts.poju,
      currency: "USD",
      checkout_url: paymentUrl,
      payment_url: paymentUrl,
      order_id: orderId,
    });
  }

  if (product === "syncro_ar") {
    const checkoutUrl = "/syncro/task?type=paid";
    return NextResponse.json({
      ok: true,
      product,
      amount: amounts.syncro_ar,
      currency: "USD",
      checkout_url: checkoutUrl,
      payment_url: checkoutUrl,
    });
  }

  return NextResponse.json({
    ok: true,
    product: "glyph",
    amount: amounts.glyph,
    currency: "USD",
    checkout_url: "/glyph/reading?paid=1",
  });
}
