"use client";

import { Suspense } from "react";

import { MatchCachedPrepPage } from "@/components/match/MatchCachedPrepPage";

export default function MatchCachedPrepRoutePage() {
  return (
    <Suspense fallback={null}>
      <MatchCachedPrepPage />
    </Suspense>
  );
}
