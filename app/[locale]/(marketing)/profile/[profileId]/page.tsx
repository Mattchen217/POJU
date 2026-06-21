import { Suspense } from "react";

import { BaseAnalysisProfilePage } from "@/components/base-analysis/BaseAnalysisProfilePage";

export default function ProfileBaseAnalysisPage() {
  return (
    <Suspense
      fallback={
        <main className="browser-flow-page min-h-screen px-6 py-16 text-center text-sm text-white/55">
          …
        </main>
      }
    >
      <BaseAnalysisProfilePage />
    </Suspense>
  );
}
