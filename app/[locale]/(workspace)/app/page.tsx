"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useUiShell } from "@/components/workspace/use-ui-shell";
import { ResumePendingCheckout } from "@/components/auth/ResumePendingCheckout";
import { parseWorkspaceTab } from "@/lib/ui-shell/resolve-ui-shell";
import { useRouter } from "@/i18n/navigation";

function WorkspaceAppInner() {
  const searchParams = useSearchParams();
  const { shell, ready } = useUiShell();
  const router = useRouter();
  const tab = parseWorkspaceTab(searchParams.get("tab"));

  useEffect(() => {
    if (!ready) return;
    if (shell === "classic") {
      router.replace("/");
    }
  }, [ready, shell, router]);

  if (!ready || shell === "classic") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ws-bg,#07070e)] text-sm text-[var(--ws-text-secondary,#9a9cae)]">
        Loading workspace…
      </div>
    );
  }

  return (
    <>
      <ResumePendingCheckout />
      <WorkspaceShell initialTab={tab} />
    </>
  );
}

export default function WorkspaceAppPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--ws-bg,#07070e)] text-sm text-[var(--ws-text-secondary,#9a9cae)]">
          Loading workspace…
        </div>
      }
    >
      <WorkspaceAppInner />
    </Suspense>
  );
}
