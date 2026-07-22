"use client";

import { Suspense, useEffect, useMemo } from "react";

import { DsHomePage, type DsHomeCopy } from "@/components/ds/DsHomePage";
import { useUiShell } from "@/components/workspace/use-ui-shell";
import { useRouter } from "@/i18n/navigation";
import {
  hasWorkspaceEntered,
  mapProductHrefForShell,
} from "@/lib/ui-shell/resolve-ui-shell";

function remapHomeCopy(copy: DsHomeCopy, shell: "classic" | "workspace"): DsHomeCopy {
  if (shell !== "workspace") return copy;
  return {
    ...copy,
    products: copy.products.map((p) => ({
      ...p,
      href: mapProductHrefForShell(p.href, shell),
    })),
    meetsMoment: {
      ...copy.meetsMoment,
      cards: copy.meetsMoment.cards.map((c) => ({
        ...c,
        href: mapProductHrefForShell(c.href, shell),
      })),
    },
    finalCta: {
      ...copy.finalCta,
      items: copy.finalCta.items.map((item) => ({
        ...item,
        href: mapProductHrefForShell(item.href, shell),
      })),
    },
  };
}

function WorkspaceLandingInner({ copy }: { copy: DsHomeCopy }) {
  const { shell, ready } = useUiShell();
  const router = useRouter();

  useEffect(() => {
    if (!ready || shell !== "workspace") return;
    if (hasWorkspaceEntered()) {
      router.replace("/app?tab=atmos");
    }
  }, [ready, shell, router]);

  const remapped = useMemo(() => remapHomeCopy(copy, shell), [copy, shell]);

  return <DsHomePage copy={remapped} />;
}

/** When shell=workspace, remaps product CTAs to `/app?tab=` and may skip landing for returners. */
export function WorkspaceAwareHome({ copy }: { copy: DsHomeCopy }) {
  return (
    <Suspense fallback={<DsHomePage copy={copy} />}>
      <WorkspaceLandingInner copy={copy} />
    </Suspense>
  );
}
