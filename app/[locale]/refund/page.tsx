import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Refund Policy — pojulife",
  description: "pojulife refund policy",
};

export default function RefundPolicyPage() {
  return <LegalDocumentPage namespace="refund" />;
}
