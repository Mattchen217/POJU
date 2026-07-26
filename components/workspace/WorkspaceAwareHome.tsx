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
  const { shell, ready } = useUiShell();
  if (!ready) return <>{classic}</>;
  return <>{shell === "workspace" ? workspace : classic}</>;
}

/**
 * Server passes classic vs workspace home trees.
 * Picks which tree to show from ui shell. Returning-visitor auto-skip to /app
 * is disabled while V2 landing is the workspace entry surface.
 */
export function WorkspaceAwareHome({
  classic,
  workspace,
}: {
  classic: ReactNode;
  workspace: ReactNode;
}) {
  return (
    <Suspense fallback={<>{classic}</>}>
      <ShellHomeSwitchInner classic={classic} workspace={workspace} />
    </Suspense>
  );
}
