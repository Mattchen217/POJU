/** Fixed welcome copy for session prepare (5 locales). */

export function getWelcomeText(locale: string): string {
  const map: Record<string, string> = {
    en: `Welcome to POJU. POJU is your AI thinking partner for breaking through life's specific obstacles — with concrete, actionable wisdom from Eastern traditions of bazi, I-Ching, and feng shui. To prepare your reading, I need your foundational energy data below.`,
    zh: `欢迎来到 POJU。POJU 是你的 AI 破局顾问，基于八字命理、易经周易、风水堪舆等东方智慧，帮你针对具体困境给出可落地的行动方案。开始前，请提供你的基础能量数据。`,
    es: `Bienvenido a POJU. POJU es tu compañero de pensamiento con IA para superar obstáculos concretos de la vida, con sabiduría oriental del bazi, el I Ching y el feng shui. Para preparar tu lectura, necesito tus datos energéticos fundamentales a continuación.`,
    fr: `Bienvenue chez POJU. POJU est votre partenaire de réflexion IA pour surmonter des obstacles de vie précis — avec une sagesse concrète et actionnable issue du bazi, du I-Ching et du feng shui. Pour préparer votre lecture, j'ai besoin de vos données énergétiques fondamentales ci-dessous.`,
    de: `Willkommen bei POJU. POJU ist Ihr KI-Denkpartner, um konkrete Lebenshindernisse zu überwinden — mit umsetzbarer Weisheit aus Bazi, I-Ging und Feng Shui. Für Ihre Lesung benötige ich unten Ihre grundlegenden Energiedaten.`,
  };
  return map[locale.split("-")[0]] ?? map.en;
}

