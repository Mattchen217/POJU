import { Suspense } from "react";

import { MatchRelationshipPage } from "@/components/match/MatchRelationshipPage";

export default function MatchRelationshipRoutePage() {
  return (
    <Suspense fallback={<div className="match-relationship-page match-relationship-page--loading">…</div>}>
      <MatchRelationshipPage />
    </Suspense>
  );
}
