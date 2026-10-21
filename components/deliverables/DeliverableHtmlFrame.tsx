"use client";

type Props = {
  html: string;
  className?: string;
  title?: string;
};

/**
 * Sandboxed iframe viewer for filled deliverable HTML (srcDoc).
 */
export function DeliverableHtmlFrame({ html, className, title }: Props) {
  return (
    <iframe
      className={["deliverable-html-frame", className].filter(Boolean).join(" ")}
      title={title || "Deliverable"}
      sandbox="allow-scripts allow-same-origin"
      srcDoc={html}
    />
  );
}
