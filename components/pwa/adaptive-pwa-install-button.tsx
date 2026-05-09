"use client";

import type { ReactNode } from "react";
import { usePwaInstall } from "@/components/pwa/pwa-install-context";

export function AdaptivePwaInstallButton({
  className = "",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const { clientReady, standalone, requestInstall } = usePwaInstall();

  if (!clientReady || standalone) return null;

  return (
    <button type="button" className={className} onClick={() => void requestInstall()}>
      {children ?? "安装应用"}
    </button>
  );
}
