import { NextResponse } from "next/server";
import { isBaseAnalysisAuditEnabled, listBaseAnalysisAudits } from "@/lib/dev/base-analysis-audit";

export async function GET() {
  if (!isBaseAnalysisAuditEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Base analysis audit is disabled in production (set POJU_BASE_ANALYSIS_AUDIT=1)." },
      { status: 403 },
    );
  }
  const items = await listBaseAnalysisAudits();
  return NextResponse.json({ ok: true, items });
}
