import { NextResponse } from "next/server";
import {
  baseAnalysisAuditEnvironmentHint,
  isBaseAnalysisAuditEnabled,
  listBaseAnalysisAudits,
} from "@/lib/dev/base-analysis-audit";

export async function GET() {
  if (!isBaseAnalysisAuditEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Base analysis audit is disabled in production (set POJU_BASE_ANALYSIS_AUDIT=1).",
        hint: baseAnalysisAuditEnvironmentHint(),
      },
      { status: 403 },
    );
  }
  const items = await listBaseAnalysisAudits();
  return NextResponse.json({
    ok: true,
    items,
    hint: baseAnalysisAuditEnvironmentHint(),
  });
}
