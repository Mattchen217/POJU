import { Suspense } from "react";

import { SyncroGuardedRoute } from "@/components/syncro/SyncroGuardedRoute";
import { SyncroLocationPage } from "@/components/syncro/SyncroLocationPage";

export default function SyncroLocationRoutePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-bg-deep">…</div>}>
      <SyncroGuardedRoute>
        <SyncroLocationPage />
      </SyncroGuardedRoute>
    </Suspense>
  );
}
