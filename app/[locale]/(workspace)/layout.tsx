import type { ReactNode } from "react";

import { WorkspaceGpuGate } from "@/components/workspace/WorkspaceGpuGate";

export default function WorkspaceRouteGroupLayout({ children }: { children: ReactNode }) {
  return <WorkspaceGpuGate>{children}</WorkspaceGpuGate>;
}
