/** True if the event target is a control (should not toggle rail collapse). */
export function isWorkspaceRailInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "label",
        "[role='button']",
        "[role='option']",
        "[role='menuitem']",
        "[role='listbox']",
        ".workspace-scroll__rail",
        ".workspace-scroll__thumb",
        ".workspace-lang-row",
        /* Energy matrix chrome — click expands list; must not close right rail */
        ".workspace-right-matrix__body",
        ".pcm-stage",
        ".pcm-rail-paper",
        ".a4-paper-sheet",
      ].join(", "),
    ),
  );
}
