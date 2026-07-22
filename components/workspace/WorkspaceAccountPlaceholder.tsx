"use client";

type Props = {
  compact?: boolean;
  className?: string;
};

/** Reserved account chip for future auth — avatar + name/email slots. */
export function WorkspaceAccountPlaceholder({ compact = false, className }: Props) {
  return (
    <div
      className={["workspace-account-chip", className].filter(Boolean).join(" ")}
      title="Account — coming soon"
    >
      <span className="workspace-account-chip__avatar" aria-hidden>
        G
      </span>
      {!compact ? (
        <span className="workspace-account-chip__text">
          <span style={{ display: "block", fontSize: 11, color: "var(--ws-text, #fff)" }}>Guest</span>
          <span style={{ display: "block", fontSize: 10, opacity: 0.7 }}>email@coming.soon</span>
        </span>
      ) : null}
    </div>
  );
}
