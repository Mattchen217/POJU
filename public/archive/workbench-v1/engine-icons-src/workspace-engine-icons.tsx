type IconProps = {
  className?: string;
};

/** Syncro · radar sweep with N/E/S/W — optical size matches Material 22px. */
export function SyncroRadarIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12.2" r="6.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12.2" r="3.9" stroke="currentColor" strokeWidth="1.4" opacity="0.75" />
      <circle cx="12" cy="12.2" r="1.25" fill="currentColor" />
      <path
        d="M12 12.2 L15.85 8.85 A6.6 6.6 0 0 1 17.15 13.05 Z"
        fill="currentColor"
        opacity="0.3"
      />
      <path
        d="M12 12.2 L15.85 8.85"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <text
        x="12"
        y="4.15"
        textAnchor="middle"
        fill="currentColor"
        fontSize="5"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
      >
        N
      </text>
      <text
        x="21.15"
        y="13.55"
        textAnchor="middle"
        fill="currentColor"
        fontSize="5"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
      >
        E
      </text>
      <text
        x="12"
        y="22.55"
        textAnchor="middle"
        fill="currentColor"
        fontSize="5"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
      >
        S
      </text>
      <text
        x="2.85"
        y="13.55"
        textAnchor="middle"
        fill="currentColor"
        fontSize="5"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
      >
        W
      </text>
    </svg>
  );
}

/** Match · two people facing each other — solid heads like Material person icons. */
export function MatchPairIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Left person — open toward center (facing right) */}
      <circle cx="6.55" cy="6.75" r="2.55" fill="currentColor" />
      <path
        d="M2.55 18.85c.3-3.85 1.85-5.75 4-5.75 1.45 0 2.7.9 3.55 2.55"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
      />
      {/* Right person — open toward center (facing left) */}
      <circle cx="17.45" cy="6.75" r="2.55" fill="currentColor" />
      <path
        d="M21.45 18.85c-.3-3.85-1.85-5.75-4-5.75-1.45 0-2.7.9-3.55 2.55"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Glyph · card with centered G — optical size matches Material 22px. */
export function GlyphCardIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="4.5"
        y="2.75"
        width="15"
        height="18.5"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <text
        x="12"
        y="15.1"
        textAnchor="middle"
        fill="currentColor"
        fontSize="10.5"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="600"
      >
        G
      </text>
    </svg>
  );
}
