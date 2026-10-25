import { Suspense } from "react";

import { SyncroGuardedRoute } from "@/components/syncro/SyncroGuardedRoute";
import { SyncroComputingPage } from "@/components/syncro/SyncroComputingPage";

export default function SyncroComputingRoutePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-bg-deep">…</div>}>
      <SyncroGuardedRoute>
        <SyncroComputingPage />
      </SyncroGuardedRoute>
    </Suspense>
  );
}
