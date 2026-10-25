import { Suspense } from "react";

import { MatchAnalyzingPage } from "@/components/match/MatchAnalyzingPage";

export default function MatchAnalyzingRoutePage() {
  return (
    <Suspense fallback={<div className="match-analyzing match-analyzing--loading">…</div>}>
      <MatchAnalyzingPage />
    </Suspense>
  );
}
