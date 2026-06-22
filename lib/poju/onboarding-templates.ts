type Product = "poju" | "glyph" | "match" | "syncro";
type Lang = "zh" | "en" | "de" | "es" | "fr";

const ONBOARDING: Record<Product, Record<Lang, string>> = {
  poju: {
    zh: "我是 POJU——你的东方破局顾问。把你此刻最纠结、定不下来的问题或困境写在下方对话框发送，我会结合你的能量结构，陪你一步步拆开其中的拉扯与卡点。",
    en: "I'm POJU — your Eastern strategy counsellor. Type the question or dilemma you're weighing right now in the box below and send; we'll unpack it together using your energy matrix as a map.",
    de: "Ich bin POJU — dein östlicher Strategieberater. Schreib die Frage oder das Dilemma, das dich gerade am meisten beschäftigt, unten in das Feld und sende sie ab; wir nehmen sie gemeinsam auseinander — deine Energiematrix als Landkarte.",
    es: "Soy POJU, tu consejero de estrategia oriental. Escribe abajo la pregunta o el dilema que más te pesa ahora mismo y envíalo; lo desentrañaremos juntos usando tu matriz de energía como mapa.",
    fr: "Je suis POJU, ton conseiller en stratégie orientale. Écris dans le champ ci-dessous la question ou le dilemme qui te pèse en ce moment et envoie-le ; nous le démêlerons ensemble, ta matrice d'énergie pour boussole.",
  },
  glyph: {
    zh: "Glyph 是一面照见当下的镜子。先想清楚你此刻最想看清的那一件事（一个抉择、一段关系、去留……），在下方输入并发送，再抽取你的签象。",
    en: "Glyph is a mirror for one moment. Name the single thing you want clarity on right now (a fork, a relationship, stay-or-go…), type it below and send, then draw your symbol.",
    de: "Glyph ist ein Spiegel für einen Moment. Benenne die eine Sache, über die du jetzt Klarheit suchst (eine Entscheidung, eine Beziehung, bleiben oder gehen…), schreib sie unten und sende sie ab, dann ziehe dein Zeichen.",
    es: "Glyph es un espejo para un solo momento. Nombra la única cosa sobre la que quieres claridad ahora (una decisión, una relación, quedarte o irte…), escríbela abajo y envíala, luego saca tu símbolo.",
    fr: "Glyph est un miroir pour un instant. Nomme la seule chose sur laquelle tu veux y voir clair maintenant (un choix, une relation, rester ou partir…), écris-la ci-dessous et envoie-la, puis tire ton symbole.",
  },
  match: {
    zh: "Match 看两个人的能量如何相遇。在下方说出你想解决或了解的关系问题（合不合、如何相处、去留……）并发送。",
    en: "Match reads how two energies meet. Describe the relationship question you want solved or understood (compatibility, how to relate, stay-or-go…) below and send.",
    de: "Match liest, wie zwei Energien aufeinandertreffen. Beschreibe unten die Beziehungsfrage, die du klären oder verstehen möchtest (Passung, Umgang miteinander, bleiben oder gehen…), und sende sie ab.",
    es: "Match interpreta cómo se encuentran dos energías. Describe abajo la pregunta de relación que quieres resolver o entender (compatibilidad, cómo llevaros, quedarte o irte…) y envíala.",
    fr: "Match lit comment deux énergies se rencontrent. Décris ci-dessous la question relationnelle que tu veux résoudre ou comprendre (compatibilité, comment vous entendre, rester ou partir…) et envoie-la.",
  },
  syncro: {
    zh: "Syncro 给你做一件事的时机与方位。在下方说明你要做什么、在哪里（面试、签约、出行……）并发送。",
    en: "Syncro gives you the timing and direction for one task. Tell me what you need to do and where (interview, signing, travel…) below and send.",
    de: "Syncro gibt dir den Zeitpunkt und die Richtung für eine Aufgabe. Sag mir unten, was du tun musst und wo (Vorstellungsgespräch, Vertragsabschluss, Reise…), und sende es ab.",
    es: "Syncro te da el momento y la dirección para una tarea. Dime abajo qué necesitas hacer y dónde (entrevista, firma, viaje…) y envíalo.",
    fr: "Syncro te donne le moment et la direction pour une tâche. Dis-moi ci-dessous ce que tu dois faire et où (entretien, signature, voyage…) et envoie-le.",
  },
};

export function getOnboardingCopy(product: Product, locale: string): string {
  const loc = (["zh", "en", "de", "es", "fr"].find((l) => locale.toLowerCase().startsWith(l)) ??
    "en") as Lang;
  return ONBOARDING[product][loc];
}
