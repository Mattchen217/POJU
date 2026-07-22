import type { DsHomeCopy } from "@/components/ds/DsHomePage";
import {
  mapProductHrefForShell,
  type UiShellMode,
} from "@/lib/ui-shell/resolve-ui-shell";

/** Remap landing product hrefs for workspace shell (server-safe). */
export function remapHomeCopyForShell(copy: DsHomeCopy, shell: UiShellMode): DsHomeCopy {
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
