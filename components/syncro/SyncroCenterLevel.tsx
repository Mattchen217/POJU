"use client";

/** Center hub — level title only (AR reference layout). */
export function SyncroCenterLevel({
  title,
  color = "#A0A4B8",
}: {
  title: string;
  color?: string;
}) {
  return (
    <div className="syncro-center-level-hub">
      <div className="syncro-center-level-overlay">
        <div className="compass-center-level" style={{ color }}>
          {title}
        </div>
      </div>
    </div>
  );
}
