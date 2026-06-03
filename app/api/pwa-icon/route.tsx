import { pojuLogoImageResponse } from "@/lib/brand/poju-logo-icon";

export const runtime = "nodejs";

function parseSize(input: string | null): number {
  const n = Number(input ?? "512");
  if (!Number.isFinite(n)) return 512;
  if (n <= 32) return 32;
  if (n >= 1024) return 1024;
  return Math.round(n);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const size = parseSize(url.searchParams.get("size"));
  return pojuLogoImageResponse(size);
}
