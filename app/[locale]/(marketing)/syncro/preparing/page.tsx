import { Suspense } from "react";

import { SyncroPreparingPage } from "@/components/syncro/SyncroPreparingPage";
import "@/styles/session-prep.css";

export default function SyncroPreparingRoutePage() {
  return (
    <Suspense fallback={<div className="session-prep-loading">…</div>}>
      <SyncroPreparingPage />
    </Suspense>
  );
}
