"use client";

import { Suspense, useEffect, type ReactNode } from "react";

import { useUiShell } from "@/components/workspace/use-ui-shell";
import { useRouter } from "@/i18n/navigation";
import { hasWorkspaceEntered } from "@/lib/ui-shell/resolve-ui-shell";

function ReturningVisitorRedirect() {
  const { shell, ready } = useUiShell();
  const router = useRouter();

  useEffect(() => {
    if (!ready || shell !== "workspace") return;
    if (hasWorkspaceEntered()) {
      router.replace("/app?tab=atmos");
    }
  }, [ready, shell, router]);

  return null;
}

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
 * Server passes two pre-built DsHomePage trees (classic vs workspace hrefs).
 * This client gate only picks which tree to show + optional returner redirect.
 * Keeps DsHomePage (and node:fs) out of the client bundle.
 */
export function WorkspaceAwareHome({
  classic,
  workspace,
}: {
  classic: ReactNode;
  workspace: ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <ReturningVisitorRedirect />
      </Suspense>
      <Suspense fallback={<>{classic}</>}>
        <ShellHomeSwitchInner classic={classic} workspace={workspace} />
      </Suspense>
    </>
  );
}
