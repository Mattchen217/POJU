const WELCOME: Record<string, string> = {
  en: `Welcome to POJU.

This is a focused space for one question — the one you brought today. We will stay with it: clarifying what is actually at stake, what you have already tried, and what a grounded next step could look like.

Before we begin, a few boundaries matter: I am an AI thinking partner, not a therapist, lawyer, doctor, or fortune teller. I do not predict fixed outcomes, and I do not decide for you. If you share birth details later, they are used only to deepen perspective — still not prophecy. Take what resonates; leave what does not. Every choice remains yours.

When you are ready, tell me in your own words what feels most stuck right now — the situation, the people involved, and what you are afraid might happen if nothing changes.`,

  zh: `欢迎来到 POJU。

这里只围绕你今天带来的那一个核心问题。我们会一起把它说清楚：真正卡住的点在哪里、你已经试过什么、以及下一步怎样更踏实。

开始前请了解边界：我是 AI 思考伙伴，不是心理治疗、法律、医疗或算命服务。我不预言既定结局，也不替你做决定。若你之后愿意补充出生信息，只用于加深理解，而不是断言命运。请只取与你共鸣的部分，所有选择仍由你承担。

准备好了，就用你自己的话告诉我：现在最让你卡住的是什么——情境、相关的人，以及你担心若一直不变可能发生什么。`,

  es: `Bienvenido a POJU.

Este es un espacio enfocado en una sola pregunta: la que trajiste hoy. Nos mantendremos en ella: aclarando qué está realmente en juego, qué has intentado ya y qué podría ser un siguiente paso con los pies en la tierra.

Antes de empezar, unos límites importan: soy una IA compañera de pensamiento, no terapeuta, abogada, médica ni adivina. No predigo resultados fijos ni decido por ti. Si más adelante compartes datos de nacimiento, solo sirven para profundizar perspectiva — no profecía. Quédate con lo que resuene; suelta lo demás. Cada elección sigue siendo tuya.

Cuando estés listo, cuéntame con tus palabras qué se siente más atascado ahora: la situación, las personas involucradas y qué temes que pase si nada cambia.`,

  fr: `Bienvenue sur POJU.

Cet espace reste centré sur une seule question — celle que vous avez apportée aujourd’hui. Nous y resterons : clarifier ce qui est réellement en jeu, ce que vous avez déjà tenté, et ce qu’un prochain pas ancré pourrait être.

Avant de commencer, quelques limites comptent : je suis une IA partenaire de réflexion, pas thérapeute, avocat, médecin ni diseuse de bonne aventure. Je ne prédis pas des issues figées et je ne décide pas à votre place. Si vous partagez plus tard des informations de naissance, elles servent uniquement à approfondir le regard — pas à prophétiser. Gardez ce qui résonne ; laissez le reste. Chaque choix reste le vôtre.

Quand vous serez prêt, dites-moi avec vos mots ce qui vous semble le plus bloqué maintenant — la situation, les personnes impliquées et ce que vous craignez si rien ne change.`,

  de: `Willkommen bei POJU.

Dieser Raum bleibt auf eine Frage fokussiert — die, die du heute mitbringst. Wir bleiben dabei: Was steht wirklich auf dem Spiel, was hast du schon versucht, und wie könnte ein nächster Schritt bodenständig aussehen?

Vorweg ein paar Grenzen: Ich bin eine KI-Denkpartnerin, keine Therapeutin, keine Anwältin, keine Ärztin und keine Wahrsagerin. Ich sage keine festen Ausgänge voraus und entscheide nicht für dich. Wenn du später Geburtsdaten teilst, dienen sie nur der vertieften Perspektive — nicht der Prophezeiung. Nimm, was bei dir ankommt; lass den Rest liegen. Jede Entscheidung bleibt deine.

Wenn du soweit bist, beschreibe in eigenen Worten, was sich gerade am meisten festfährt — die Situation, die beteiligten Menschen und was du befürchtest, wenn sich nichts ändert.`,
};

export function getWelcomeMessage(locale: string): string {
  const lang = locale.split("-")[0].toLowerCase();
  return WELCOME[lang] ?? WELCOME.en;
}
