import { Suspense } from "react";

import { MatchSelectAPage } from "@/components/match/MatchSelectAPage";

export default function MatchSelectARoutePage() {
  return (
    <Suspense fallback={<div className="match-select-page match-select-page--loading">…</div>}>
      <MatchSelectAPage />
    </Suspense>
  );
}
