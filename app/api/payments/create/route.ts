import { NextResponse } from "next/server";

type Product = "poju" | "glyph" | "syncro_ar";

function randomToken(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 占位收银台：真实 Dodo 回调后续接入。POJU $9.99 走 /start → /chat?token=… 与 Chat 引导一致。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { product?: string };
  const raw = String(body.product ?? "glyph").toLowerCase();
  const product: Product =
    raw === "poju" ? "poju" : raw === "syncro_ar" || raw === "syncro" ? "syncro_ar" : "glyph";

  const amounts: Record<Product, number> = {
    poju: 9.99,
    glyph: 1.99,
    syncro_ar: 1.99,
  };

  if (product === "poju") {
    const token = randomToken("poju_paid");
    const next = `/start?next=${encodeURIComponent(`/chat?token=${token}`)}`;
    return NextResponse.json({
      ok: true,
      product,
      amount: amounts.poju,
      currency: "USD",
      checkout_url: next,
    });
  }

  if (product === "syncro_ar") {
    return NextResponse.json({
      ok: true,
      product,
      amount: amounts.syncro_ar,
      currency: "USD",
      checkout_url: "/start?next=%2Fsyncro%2Far",
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
