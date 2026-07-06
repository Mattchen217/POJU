/** Deterministic confirmation intent from user text (awaiting_confirmation). */
export function classifyConfirmationAffirmative(
  userInput: string,
): "confirmed" | "wants_to_add" | null {
  const t = userInput.trim();
  if (!t || t === "__OPENING__" || t.startsWith("[SYSTEM:")) return null;

  if (
    /(?:还有|补充|修正|不对|漏了|另外|还想说|其实还|add(?:itional)?|correction|not quite|also want)/i.test(
      t,
    )
  ) {
    return "wants_to_add";
  }

  if (
    /^(?:好的?|好(?:的)?|可以|行|嗯+|没问题|对的?|没错|是这样|就这样|开始吧?|继续吧?|没有(?:了|补充|别的)?|没了|就这样吧|理解(?:得)?(?:很)?准确|可以开始|可以了|ok|yes|yep|sure|proceed|go ahead|looks good|that'?s (?:right|correct)|no more)[。！!？?…~]*$/i.test(
      t,
    )
  ) {
    return "confirmed";
  }

  if (
    /^(?:没有(?:什么)?(?:要)?补充|就(?:这样|这些)(?:吧|了)?|可以(?:开始|交付|了)|(?:以上|这样)(?:理解)?(?:都)?(?:准确|对))[。！!？?…]*$/i.test(
      t,
    )
  ) {
    return "confirmed";
  }

  if (t.length >= 24) return "wants_to_add";

  if (/^(?:继续|再试|重试|retry|try again|continue)$/i.test(t)) return "confirmed";

  return null;
}
