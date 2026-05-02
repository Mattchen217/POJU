import { LEVEL_META, type GlyphLevel } from "@/types/oracle";

export async function saveCardBack(
  level: GlyphLevel,
  signNumber: number,
): Promise<{ success: boolean; method: string }> {
  const meta = LEVEL_META[level];
  const imagePath = `/oracle/wind-cards/${meta.back_image_filename}`;
  const filename = `poju-glyph-${String(signNumber).padStart(3, "0")}-${level.replace(/_/g, "-")}.png`;

  try {
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

    if (isMobile && navigator.share) {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title: "A glyph from POJU",
            text: "A sincere heart opens the channel. pojulife.com",
            files: [file],
          });
          return { success: true, method: "mobile-share" };
        } catch (e) {
          if ((e as Error).name === "AbortError") {
            return { success: false, method: "user-canceled" };
          }
        }
      }
    }

    const response = await fetch(imagePath);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, method: "download" };
  } catch (error) {
    console.error("Save card failed:", error);
    return { success: false, method: "failed" };
  }
}
