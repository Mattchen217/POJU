import pojuAvatar from "@/assets/icons/P.png";

/**
 * Pivot AI mark — meditation glyph only (no disc), landing-page gold metal fill.
 */
export function PojuAiAvatar() {
  return (
    <span className="pchat__ai-avatar" aria-hidden>
      <span
        className="pchat__ai-avatar__glyph"
        style={{
          WebkitMaskImage: `url(${typeof pojuAvatar === "string" ? pojuAvatar : pojuAvatar.src})`,
          maskImage: `url(${typeof pojuAvatar === "string" ? pojuAvatar : pojuAvatar.src})`,
        }}
      />
    </span>
  );
}
