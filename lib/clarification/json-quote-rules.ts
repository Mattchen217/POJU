/**
 * Shared prompt block: JSON string fields must not contain unescaped ASCII `"`.
 * Prevents classic truncation when extracting `response` / `options`.
 */
export const CLARIFICATION_JSON_QUOTE_RULES = `# response 里的引号（硬要求 · 防 JSON 截断）
response / options 等是 JSON 字符串字段。若要在正文里用引号强调某个词，
【必须】用中文引号「」或『』，【禁止】在字符串值内部写未转义的英文双引号 "。
错（会截断）: "response":"那个"对了"的人"
对: "response":"那个「对了」的人"
若非要用英文双引号，必须写成 \\"（强烈建议直接用中文引号）。
——任何 JSON 字符串字段内部，都不能出现未转义的英文双引号。`;
