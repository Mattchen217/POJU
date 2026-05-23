/** Fixed welcome copy for session prepare (5 locales). */

export type SessionPrepProduct = "poju" | "glyph" | "syncro" | "match";

export type MatchPrepPerson = "a" | "b";

export function getWelcomeText(
  locale: string,
  productType: SessionPrepProduct = "poju",
  matchPerson: MatchPrepPerson = "a",
): string {
  const lang = locale.split("-")[0];

  if (productType === "glyph") {
    const glyph: Record<string, string> = {
      en: `Welcome to Glyph. Glyph weaves your bazi foundation with classical oracle wisdom to illuminate your present moment. Please provide your foundational energy data below.`,
      zh: `欢迎来到 Glyph。Glyph 结合你的八字命局与古典签文，为你抽出当下处境的指引。请提供你的基础能量数据。`,
      es: `Bienvenido a Glyph. Glyph entrelaza tu base del bazi con la sabiduría clásica del oráculo para iluminar tu momento presente. Indica tus datos energéticos fundamentales.`,
      fr: `Bienvenue sur Glyph. Glyph associe votre fondation bazi à la sagesse classique de l'oracle pour éclairer l'instant présent. Merci d'indiquer vos données énergétiques fondamentales.`,
      de: `Willkommen bei Glyph. Glyph verbindet Ihre Bazi-Grundlage mit klassischer Orakelweisheit, um Ihren gegenwärtigen Moment zu beleuchten. Bitte geben Sie unten Ihre grundlegenden Energiedaten an.`,
    };
    return glyph[lang] ?? glyph.en;
  }

  if (productType === "syncro") {
    const syncro: Record<string, string> = {
      en: `Welcome to Syncro. Syncro uses your chart to find optimal timing and direction for your actions. Please provide your foundational energy data below.`,
      zh: `欢迎来到 Syncro。Syncro 用你的命局测算最适合行动的时辰与方位。请提供你的基础能量数据。`,
      es: `Bienvenido a Syncro. Syncro usa tu carta para encontrar el momento y la dirección óptimos para tus acciones. Indica tus datos energéticos fundamentales.`,
      fr: `Bienvenue sur Syncro. Syncro utilise votre thème pour trouver le moment et la direction optimaux pour vos actions. Merci d'indiquer vos données énergétiques fondamentales.`,
      de: `Willkommen bei Syncro. Syncro nutzt Ihr Horoskop, um optimales Timing und die passende Richtung für Ihre Handlungen zu finden. Bitte geben Sie unten Ihre grundlegenden Energiedaten an.`,
    };
    return syncro[lang] ?? syncro.en;
  }

  if (productType === "match") {
    if (matchPerson === "b") {
      const matchB: Record<string, string> = {
        en: `Now select the second person's bazi — or add a new chart. It will be saved to your profile library automatically.`,
        zh: `请选择第二个命主的八字信息，或新建命盘。会自动保存到你的命主库。`,
        es: `Ahora elige el bazi de la segunda persona o añade una carta nueva. Se guardará automáticamente en tu biblioteca de perfiles.`,
        fr: `Choisissez maintenant le bazi de la deuxième personne — ou ajoutez une nouvelle carte. Elle sera enregistrée automatiquement dans votre bibliothèque.`,
        de: `Wählen Sie nun das Bazi der zweiten Person — oder legen Sie ein neues Chart an. Es wird automatisch in Ihrer Profilbibliothek gespeichert.`,
      };
      return matchB[lang] ?? matchB.en;
    }
    const matchA: Record<string, string> = {
      en: `Welcome to Match. Select the first person's bazi below — or add a new chart if they are not saved yet.`,
      zh: `欢迎来到 Match。请选择第一个命主的八字信息；若尚未保存，可新建命盘。`,
      es: `Bienvenido a Match. Elige el bazi de la primera persona a continuación, o añade una carta nueva si aún no está guardada.`,
      fr: `Bienvenue sur Match. Choisissez le bazi de la première personne ci-dessous — ou ajoutez une nouvelle carte si elle n'est pas encore enregistrée.`,
      de: `Willkommen bei Match. Wählen Sie unten das Bazi der ersten Person — oder legen Sie ein neues Chart an, falls es noch nicht gespeichert ist.`,
    };
    return matchA[lang] ?? matchA.en;
  }

  const poju: Record<string, string> = {
    en: `Welcome to POJU. POJU is your AI thinking partner for breaking through life's specific obstacles — with concrete, actionable wisdom from Eastern traditions of bazi, I-Ching, and feng shui. To prepare your reading, I need your foundational energy data below.`,
    zh: `欢迎来到 POJU。POJU 是你的 AI 破局顾问，基于八字命理、易经周易、风水堪舆等东方智慧，帮你针对具体困境给出可落地的行动方案。开始前，请提供你的基础能量数据。`,
    es: `Bienvenido a POJU. POJU es tu compañero de pensamiento con IA para superar obstáculos concretos de la vida, con sabiduría oriental del bazi, el I Ching y el feng shui. Para preparar tu lectura, necesito tus datos energéticos fundamentales a continuación.`,
    fr: `Bienvenue chez POJU. POJU est votre partenaire de réflexion IA pour surmonter des obstacles de vie précis — avec une sagesse concrète et actionnable issue du bazi, du I-Ching et du feng shui. Pour préparer votre lecture, j'ai besoin de vos données énergétiques fondamentales ci-dessous.`,
    de: `Willkommen bei POJU. POJU ist Ihr KI-Denkpartner, um konkrete Lebenshindernisse zu überwinden — mit umsetzbarer Weisheit aus Bazi, I-Ging und Feng Shui. Für Ihre Lesung benötige ich unten Ihre grundlegenden Energiedaten.`,
  };
  return poju[lang] ?? poju.en;
}

export function getSessionPrepBrand(productType: SessionPrepProduct): string {
  if (productType === "glyph") return "GLYPH";
  if (productType === "syncro") return "SYNCRO";
  if (productType === "match") return "MATCH";
  return "POJU";
}

