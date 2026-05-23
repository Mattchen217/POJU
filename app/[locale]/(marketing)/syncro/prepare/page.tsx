import { Suspense } from "react";

import { SyncroPreparePage } from "@/components/syncro/SyncroPreparePage";
import "@/styles/session-prep.css";

export default function SyncroPrepareRoutePage() {
  return (
    <Suspense fallback={<div className="session-prep-loading">…</div>}>
      <SyncroPreparePage />
    </Suspense>
  );
}
