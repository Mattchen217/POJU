import { LEVEL_META, type GlyphLevel } from "@/types/oracle";

export async function shareCardBack(
  level: GlyphLevel,
  signNumber: number,
): Promise<{ success: boolean; method: string }> {
  const meta = LEVEL_META[level];
  const imagePath = `/oracle/wind-cards/${meta.back_image_filename}`;
  const filename = `poju-glyph-${String(signNumber).padStart(3, "0")}.png`;

  try {
    if (navigator.share) {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "A glyph from POJU",
          text: "A sincere heart opens the channel. easternos.com",
          files: [file],
        });
        return { success: true, method: "native-share" };
      }
    }

    const response = await fetch(imagePath);
    const blob = await response.blob();

    if (navigator.clipboard && "ClipboardItem" in window) {
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      return { success: true, method: "clipboard" };
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    return { success: true, method: "download" };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return { success: false, method: "user-canceled" };
    }
    console.error("Share card failed:", error);
    return { success: false, method: "failed" };
  }
}
