"use client";

import { PojuAiAvatar } from "@/components/poju/PojuAiAvatar";
import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { ToolMatrixNarrativeReply } from "@/components/cross-product/ToolMatrixNarrativeReply";
import type { MatrixNarrativeResponse } from "@/lib/llm/prompts/matrix-narrative-prompt";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { ToolName } from "@/lib/poju/types";

import "@/components/poju/poju-chat.css";
import "@/styles/poju-energy-matrix.css";
import "@/styles/tool-preview-chat.css";

export type ToolPreviewMatrixItem = {
  payload: PojuMatrixPayload;
  /** @deprecated Prefer subjectPrefix — shown above matrix in tool preview. */
  label?: string;
  /** e.g. 用户A： — prepended to born / coordinates / matrix id line. */
  subjectPrefix?: string;
};

type Props = {
  product: ToolName;
  locale: string;
  matrices: ToolPreviewMatrixItem[];
  narrative?: MatrixNarrativeResponse | null;
};

/** Matrix + narrative in the same structure as POJU chat (bare matrix, then avatar reply). */
export function ToolPreviewChatSection({ product, locale, matrices, narrative }: Props) {
  const payloadA = matrices[0]?.payload;
  const payloadB = matrices[1]?.payload ?? null;
  if (!payloadA) return null;

  return (
    <section className="tool-preview-chat pchat" aria-label="Energy matrix preview">
      <div className="pchat__messages tool-preview-chat__messages">
        {matrices.map((item, index) => (
          <div key={item.subjectPrefix ?? item.label ?? `matrix-${index}`} className="pchat__msg pchat__msg--ai">
            {item.label && !item.subjectPrefix ? (
              <span className="tool-preview-chat__matrix-label">{item.label}</span>
            ) : null}
            <PojuEnergyMatrix
              payload={item.payload}
              locale={locale}
              compact
              subjectPrefix={item.subjectPrefix}
            />
          </div>
        ))}

        <div className="pchat__msg pchat__msg--ai">
          <div className="pchat__ai-row">
            <PojuAiAvatar />
            <div className="pchat__ai">
              <ToolMatrixNarrativeReply
                product={product}
                locale={locale}
                payloadA={payloadA}
                payloadB={payloadB}
                narrative={narrative}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
