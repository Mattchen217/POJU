"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  children: ReactNode;
};

export function GlyphSectionLabel({ icon: Icon, children }: Props) {
  return (
    <div className="section-label">
      <span className="sl-icon" aria-hidden>
        <Icon size={15} strokeWidth={2} />
      </span>
      {children}
    </div>
  );
}
