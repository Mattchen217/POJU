"use client";

import { cn } from "@/lib/utils/classnames";

type Props = {
  className?: string;
};

export function ArchiveUnreadDot({ className }: Props) {
  return <span className={cn("archive-unread-dot", className)} aria-hidden />;
}

type NavLabelProps = {
  label: string;
  showDot: boolean;
  className?: string;
};

/** Nav / tab label with optional unread indicator. */
export function ArchiveNavLabel({ label, showDot, className }: NavLabelProps) {
  return (
    <span className={cn("archive-nav-label", className)}>
      {label}
      {showDot ? <ArchiveUnreadDot /> : null}
    </span>
  );
}
