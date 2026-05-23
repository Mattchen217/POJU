import { Suspense } from "react";

import { SyncroComputingPage } from "@/components/syncro/SyncroComputingPage";

export default function SyncroComputingRoutePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-bg-deep">…</div>}>
      <SyncroComputingPage />
    </Suspense>
  );
}
