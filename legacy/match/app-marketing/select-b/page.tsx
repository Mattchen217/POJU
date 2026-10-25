import { Suspense } from "react";

import { MatchSelectBPage } from "@/components/match/MatchSelectBPage";

export default function MatchSelectBRoutePage() {
  return (
    <Suspense fallback={<div className="match-select-page match-select-page--loading">…</div>}>
      <MatchSelectBPage />
    </Suspense>
  );
}
