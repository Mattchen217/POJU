import { Suspense } from "react";
import type { Metadata } from "next";

import { MatchHomePage } from "@/components/match/MatchHomePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Match — Eastern OS",
  description:
    "Two personality profiles, one relationship. Deep compatibility reading for couples, partners, family, and teams.",
};

export default function MatchPage() {
  return (
    <Suspense fallback={<div className="match-home match-home--loading">…</div>}>
      <MatchHomePage />
    </Suspense>
  );
}
