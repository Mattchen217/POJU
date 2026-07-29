/**
 * Regression: English loanword accents must not flip chat output to es/fr.
 * Run: pnpm exec tsx scripts/test-language-detect-loanwords.ts
 */
import {
  detectLanguage,
  resolvePojuSessionOutputLocale,
} from "../lib/prompts/language-directive";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const englishWithAccents = [
  "My fiancé got a job offer abroad and I am protecting our relationship",
  "I sent my résumé to the company yesterday",
  "café meeting with my boss about the promotion",
  "Should I take this role or stay with my partner?",
];

for (const s of englishWithAccents) {
  assert(detectLanguage(s) === "en", `expected en for: ${s} (got ${detectLanguage(s)})`);
  assert(
    resolvePojuSessionOutputLocale({
      uiLocale: "en",
      userInput: s,
      conversationHistory: [],
    }) === "en",
    `session locale expected en for: ${s}`,
  );
}

assert(detectLanguage("¿Qué debo hacer con mi carrera?") === "es", "¿¡ → es");
assert(
  detectLanguage("Hola, gracias, estoy muy bien ahora") === "es",
  "Spanish function words → es",
);
assert(detectLanguage("我想换工作但也担心感情") === "zh", "CJK → zh");

console.log("test-language-detect-loanwords: ok");
