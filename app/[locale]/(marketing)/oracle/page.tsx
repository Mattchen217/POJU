import { GlyphMarketingPage, glyphMarketingMetadata } from "@/components/marketing/glyph-marketing-page";

/** Legacy URL — same full marketing page as `/glyph` (next.config redirects here). */
export const metadata = glyphMarketingMetadata;

export default function OraclePage() {
  return <GlyphMarketingPage />;
}
