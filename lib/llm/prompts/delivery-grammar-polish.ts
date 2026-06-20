/**
 * Output-time grammar polish self-check — injected into delivery system prompts.
 * @see Cursor 指令 - 交付文案语法润色自检.md
 */

export function buildDeliveryGrammarPolishBlock(outputLang: string): string {
  const lang = outputLang?.trim() || "en";
  return `# 输出前润色自检（写完所有字段后、返回前执行）

逐字段快速过一遍语言质量，修正后再返回：
1. **冠词**：元音音开头的词前用 "an"（an inner sharpness / an hour），辅音音前用 "a"；注意发音例外仍用 a（a one-year plan / a unique angle / a university mentor）。
2. **单复数、主谓一致、时态统一**。
3. **拼写、重复词**（如不小心写出两次同一个词）、标点（中英标点不混用）。
4. 用当前交付语言（**${lang}**）通读是否自然、像母语者写的。

仅做语言润色，**不改变**已确定的分析内容与术语标记 ⟦t:id|…⟧。`;
}
