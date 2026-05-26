import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Cookie Policy — pojulife",
  description: "pojulife cookie policy",
};

export default function CookiesPage() {
  return <LegalDocumentPage namespace="cookies" />;
}
