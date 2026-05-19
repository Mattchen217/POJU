import { NextResponse } from "next/server";
import { getBaseAnalysisAudit, isBaseAnalysisAuditEnabled } from "@/lib/dev/base-analysis-audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  if (!isBaseAnalysisAuditEnabled()) {
    return NextResponse.json({ ok: false, error: "Audit disabled" }, { status: 403 });
  }
  const { id } = await params;
  const record = await getBaseAnalysisAudit(id);
  if (!record) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, record });
}
