import type { ReactNode } from "react";
import { Suspense } from "react";

import { WorkspaceGpuGate } from "@/components/workspace/WorkspaceGpuGate";

export default function WorkspaceRouteGroupLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <WorkspaceGpuGate />
      </Suspense>
      {children}
    </>
  );
}
