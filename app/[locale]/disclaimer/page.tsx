import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Disclaimer — pojulife",
  description: "pojulife disclaimer",
};

export default function DisclaimerPage() {
  return <LegalDocumentPage namespace="disclaimer" />;
}
