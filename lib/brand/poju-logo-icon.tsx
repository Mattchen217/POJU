import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

export const POJU_LOGO_PATH = path.join(process.cwd(), "assets", "images", "POJUlogo.png");

export async function readPojuLogoDataUrl(): Promise<string> {
  const buf = await readFile(POJU_LOGO_PATH);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/** Square PNG icon from POJU logo — favicon, PWA, apple-touch. */
export async function pojuLogoImageResponse(size: number) {
  const src = await readPojuLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
        }}
      >
        <img
          src={src}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
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
