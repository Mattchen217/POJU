import { Suspense } from "react";

import { MatchResultPage } from "@/components/match/MatchResultPage";

export default function MatchResultRoutePage() {
  return (
    <Suspense fallback={<main className="match-result-loading">…</main>}>
      <MatchResultPage />
    </Suspense>
  );
}
