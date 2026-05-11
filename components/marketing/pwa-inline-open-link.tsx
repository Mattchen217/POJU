"use client";

import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

type PwaInlineOpenLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: ComponentProps<typeof Link>["href"];
  children: ReactNode;
  /** @deprecated No longer used; navigation is always same-window. */
  target?: string;
  rel?: string;
  frameTitle?: string;
  closeLabel?: string;
};

/** Same-window navigation only (PWA-friendly, no iframe / new tab). */
export function PwaInlineOpenLink({
  href,
  children,
  className,
  target: _target,
  rel: _rel,
  frameTitle: _frameTitle,
  closeLabel: _closeLabel,
  ...rest
}: PwaInlineOpenLinkProps) {
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}
