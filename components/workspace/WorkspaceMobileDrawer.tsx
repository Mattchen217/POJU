"use client";

import { useEffect, useId, useRef } from "react";

import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import type { WorkspaceTab } from "@/lib/ui-shell/resolve-ui-shell";

type Props = {
  open: boolean;
  onClose: () => void;
  activeTab: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
  onOpenLegal: () => void;
  labelledBy?: string;
  id?: string;
};

export function WorkspaceMobileDrawer({
  open,
  onClose,
  activeTab,
  onSelect,
  onOpenLegal,
  labelledBy,
  id = "workspace-mobile-drawer",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => {
      panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div
      id={id}
      className={`workspace-mobile-drawer${open ? " is-open" : ""}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="workspace-mobile-drawer__backdrop"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="workspace-mobile-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
      >
        <span id={titleId} className="sr-only">
          Workspace menu
        </span>
        <WorkspaceSidebar
          activeTab={activeTab}
          onSelect={(tab) => {
            onSelect(tab);
            onClose();
          }}
          onOpenLegal={() => {
            onOpenLegal();
            onClose();
          }}
        />
      </div>
    </div>
  );
}
