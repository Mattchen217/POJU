import { Suspense } from "react";

import { SyncroPreviewPage } from "@/components/syncro/SyncroPreviewPage";

export default function SyncroPreviewRoutePage() {
  return (
    <Suspense fallback={<div className="session-prep-loading">…</div>}>
      <SyncroPreviewPage />
    </Suspense>
  );
}
