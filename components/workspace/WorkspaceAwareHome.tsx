"use client";

import { Suspense, type ReactNode } from "react";

import { useUiShell } from "@/components/workspace/use-ui-shell";

function ShellHomeSwitchInner({
  classic,
  workspace,
}: {
  classic: ReactNode;
  workspace: ReactNode;
}) {
  const { shell } = useUiShell();
  return <>{shell === "workspace" ? workspace : classic}</>;
}

function HomeShellPaint() {
  return <div className="fixed inset-0 z-0 bg-[#05070a]" aria-hidden />;
}

/**
 * Server passes classic vs workspace home trees (legacy helper).
 * Prefer dedicated routes: `/` = V2, `/classic` = V1 marketing.
 */
export function WorkspaceAwareHome({
  classic,
  workspace,
}: {
  classic: ReactNode;
  workspace: ReactNode;
}) {
  return (
    <Suspense fallback={<HomeShellPaint />}>
      <ShellHomeSwitchInner classic={classic} workspace={workspace} />
    </Suspense>
  );
}
