import type { ReactNode } from "react";

import { NotesBlackBox } from "@/components/marketing/product-notes-panel";
import { GlassSection } from "@/components/ui/GlassSection";
import { cn } from "@/lib/utils/classnames";

type LegalPageShellProps = {
  title: string;
  children: ReactNode;
  version?: string;
  updated?: string;
  intro?: ReactNode;
  footer?: ReactNode;
  maxWidth?: "md" | "lg";
};

/** 法律/联系页：外层灰白毛玻璃 + 内层无框黑底正文（Notes 参考） */
export function LegalPageShell({
  title,
  children,
  version,
  updated,
  intro,
  footer,
  maxWidth = "lg",
}: LegalPageShellProps) {
  return (
    <main className="legal-page text-text-body">
      <div className="legal-page__wrap">
        <GlassSection
          padding="lg"
          className={cn("legal-page__panel", maxWidth === "md" && "legal-page__panel--md")}
        >
          <header className="legal-page__header">
            {version ? <p className="legal-page__version">{version}</p> : null}
            <h1 className="legal-page__title">{title}</h1>
            {updated ? (
              <p className="legal-page__updated">
                <em>{updated}</em>
              </p>
            ) : null}
            {intro ? <div className="legal-page__intro">{intro}</div> : null}
          </header>

          <NotesBlackBox className="legal-page__content legal-prose">{children}</NotesBlackBox>

          {footer ? <div className="legal-page__footer">{footer}</div> : null}
        </GlassSection>
      </div>
    </main>
  );
}
