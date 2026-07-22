type IconProps = {
  className?: string;
};

/**
 * Dock toggles — heavier optical weight to sit with Material filled engine icons.
 * Solid rail slab + 2px frame (not hairline strokes).
 */

/** Idle: rounded panel with solid left rail. */
export function SidebarDockIdleIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M3 7c0-1.657 1.343-3 3-3h4v16H6c-1.657 0-3-1.343-3-3V7Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Hover · sidebar open: solid rail + left chevron (collapse). */
export function SidebarDockCollapseIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M3 7c0-1.657 1.343-3 3-3h4v16H6c-1.657 0-3-1.343-3-3V7Z"
        fill="currentColor"
      />
      <path
        d="M16.25 8.5 12.75 12l3.5 3.5"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Hover · sidebar collapsed: solid right rail + right chevron (expand). */
export function SidebarDockExpandIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M14 4h4c1.657 0 3 1.343 3 3v10c0 1.657-1.343 3-3 3h-4V4Z"
        fill="currentColor"
      />
      <path
        d="M7.75 8.5 11.25 12l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
