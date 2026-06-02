"use client";

/** Center level title — same footprint as AR camera circle (no video). */
export function SyncroLevelHub({
  title,
  color,
  sizePx,
}: {
  title: string;
  color: string;
  sizePx: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: sizePx,
        height: sizePx,
        borderRadius: "50%",
        overflow: "hidden",
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle, rgba(7, 9, 26, 0.5) 0%, transparent 70%)",
          textShadow: "0 1px 4px rgba(0, 0, 0, 0.8)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, color, textAlign: "center", padding: "0 8px" }}>
          {title}
        </div>
      </div>
    </div>
  );
}
