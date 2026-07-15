import { NextResponse } from "next/server";

/**
 * PART 2: matrix-narrative LLM path removed.
 * Welcome / preview copy is assembled locally from compliant templates
 * (see ensureProfileMatrixList → matrixListFromTemplateDisplay).
 */
export const maxDuration = 10;

export async function POST() {
  console.warn(
    "[fallback] POST /api/poju/matrix-narrative called — LLM path removed; use template ensureProfileMatrixList",
  );
  return NextResponse.json(
    {
      error: "matrix_narrative_removed",
      message:
        "Matrix welcome copy is template-only (zero LLM). Clients must use ensureProfileMatrixList / buildMatrixDisplayData.",
      fallback: "template",
    },
    { status: 410 },
  );
}
