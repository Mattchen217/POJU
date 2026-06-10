import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

export const POJU_LOGO_PATH = path.join(process.cwd(), "assets", "images", "POJUlogo.png");

/** Tight square crop around visible logo pixels (1280×1429 source). */
const ICON_CROP = {
  x: 247,
  y: 324,
  size: 801,
  srcW: 1280,
  srcH: 1429,
} as const;

export async function readPojuLogoDataUrl(): Promise<string> {
  const buf = await readFile(POJU_LOGO_PATH);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/** Square PNG icon from POJU logo — favicon, PWA, apple-touch. */
export async function pojuLogoImageResponse(size: number) {
  const src = await readPojuLogoDataUrl();
  const { x, y, size: cropSize, srcW, srcH } = ICON_CROP;
  const imgWidthPct = (srcW / cropSize) * 100;
  const imgHeightPct = (srcH / cropSize) * 100;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "transparent",
        }}
      >
        <img
          src={src}
          alt=""
          style={{
            position: "absolute",
            width: `${imgWidthPct}%`,
            height: `${imgHeightPct}%`,
            left: `${-(x / cropSize) * 100}%`,
            top: `${-(y / cropSize) * 100}%`,
            objectFit: "fill",
          }}
        />
      </div>
    ),
    {
      width: size,
      height: size,
    },
  );
}
