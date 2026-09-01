/**
 * Delivery page-schema slot chrome (P1–P6 UI labels).
 * SSOT for DeliveryPageSlots — zh / en / es / fr (de → en via bucket).
 */

import {
  deliveryLocaleBucket,
  type DeliveryLocaleBucket,
} from "@/lib/llm/pro/delivery/delivery-locale";

type DimCopy = { high: string; mid: string; low: string; unknown: string };

export type DeliverySlotUiCopy = {
  coreJudgment: string;
  primary: string;
  backup: string;
  primaryBadge: string;
  backupBadge: string;
  matrixTitle: string;
  matrixDim: string;
  matrixGoal: string;
  matrixBody: string;
  matrixRisk: string;
  matrixWhen: string;
  coreLogic: string;
  why: string;
  when: string;
  whenBackup: string;
  chip: string;
  dims: string;
  dimsHint: string;
  body: string;
  mind: string;
  field: string;
  dimBody: DimCopy;
  dimMind: DimCopy;
  dimField: DimCopy;
  riskLabel: DimCopy;
  surface: string;
  essence: string;
  dashboard: string;
  strategy: string;
  means: string;
  angle: string;
  angleGloss: string;
  primaryTrackGloss: string;
  backupTrackGloss: string;
  dimension: string;
  dimensionGloss: string;
  /** P4 card title: question + desired outcome */
  anchorTitle: string;
  /** Short label for P4 evidence expand chrome */
  anchorShort: string;
  anchorGloss: string;
  leverage: string;
  leverageGloss: string;
  avoid: string;
  avoidGloss: string;
  fieldMatrix: string;
  fieldMatrixGloss: string;
  day7: string;
  day7Gloss: string;
  identityGloss: string;
  identityShiftLabel: string;
  quoteTitle: string;
  quoteGloss: string;
  quoteUseLabel: string;
  tonight: string;
  tonightGloss: string;
  tonightDoneLabel: string;
  tonightWhyLabel: string;
  day7WhyLabel: string;
  day7DoneLabel: string;
  takeaways: string;
  takeawaysGloss: string;
  script: string;
  metrics: string;
  leverageMark: string;
  avoidMark: string;
  question: string;
  desired: string;
  bridgeNote: string;
  redLights: string;
  redLightsGloss: string;
  traps: string;
  trapsGloss: string;
  switchBackup: string;
  switchBackupGloss: string;
  protection: string;
  protectionGloss: string;
  riskSit: string;
  riskDo: string;
  riskWatch: string;
  riskForbid: string;
  boundaryScript: string;
  before: string;
  after: string;
  alert: string;
  week: (n: number) => string;
  evidencePrimary: string;
  evidenceBackup: string;
  evidenceJudgment: string;
  evidenceFor: (title: string) => string;
  evidenceWhy: (title: string) => string;
};

const BY_LOCALE: Record<Exclude<DeliveryLocaleBucket, "de">, Omit<DeliverySlotUiCopy, "week" | "evidenceFor" | "evidenceWhy"> & {
  weekTpl: string;
  evidenceForTpl: string;
  evidenceWhyTpl: string;
}> = {
  zh: {
    coreJudgment: "核心判定",
    primary: "主方案",
    backup: "辅方案",
    primaryBadge: "优先推荐 · 攻坚破局轨",
    backupBadge: "托底退路 · 安全止损轨",
    matrixTitle: "主辅双轨决策对比",
    matrixDim: "评估维度",
    matrixGoal: "战略目标",
    matrixBody: "身体消耗",
    matrixRisk: "现实风险",
    matrixWhen: "适用触发点",
    coreLogic: "核心打法",
    why: "为何",
    when: "适用条件",
    whenBackup: "触发条件",
    chip: "破局核心筹码",
    dims: "执行消耗",
    dimsHint: "走这条路时，身体 / 心理 / 现实各要扛多少",
    body: "身体",
    mind: "心理",
    field: "现实",
    dimBody: { high: "高消耗", mid: "中等消耗", low: "低消耗", unknown: "待测" },
    dimMind: { high: "高负荷", mid: "中位", low: "低负荷", unknown: "待测" },
    dimField: { high: "高阻力", mid: "中等阻力", low: "低阻力", unknown: "待测" },
    riskLabel: { high: "高风险", mid: "中风险", low: "极低风险", unknown: "—" },
    surface: "表象",
    essence: "本质",
    dashboard: "真算仪表盘",
    strategy: "策略",
    means: "行动",
    angle: "策略维",
    angleGloss: "",
    primaryTrackGloss: "对本案主路径的科学操盘维（策略 + 行动）",
    backupTrackGloss: "主路径谈不拢时的退路操盘维（策略 + 行动）",
    dimension: "策略维",
    dimensionGloss: "",
    anchorTitle: "锚定 · 问题与期望",
    anchorShort: "问题与期望",
    anchorGloss: "本页只服务这件事，不另开主辅轨",
    leverage: "借力",
    leverageGloss: "可借的非对称杠杆（短句可扫）",
    avoid: "避坑",
    avoidGloss: "本案要躲开的东方/场域坑",
    fieldMatrix: "场域矩阵",
    fieldMatrixGloss: "场域对照速览",
    day7: "近7日微清单",
    day7Gloss: "可勾选近阶条目：做什么、为何这周、怎样算勾上",
    identityGloss: "对照角色变化，并看清为何必须切",
    identityShiftLabel: "为何切换",
    quoteTitle: "定心金句",
    quoteGloss: "带走一句，压住摇摆",
    quoteUseLabel: "怎么用",
    tonight: "今晚一件事",
    tonightGloss: "只做这一件：做什么、做成什么样、为何今晚",
    tonightDoneLabel: "做成什么样",
    tonightWhyLabel: "为何今晚",
    day7WhyLabel: "为何这周",
    day7DoneLabel: "勾选标准",
    takeaways: "带走三样",
    takeawaysGloss: "决策 · 本周杠杆 · 熔断——各一行印章，不是摘要墙",
    script: "开口",
    metrics: "硬指标",
    leverageMark: "借",
    avoidMark: "避",
    question: "问题",
    desired: "期望",
    bridgeNote:
      "本页按收集到的多个真实表象对症分析；怎么做见后续破局策略 / 自我调频页。",
    redLights: "红灯",
    redLightsGloss: "一旦出现就必须停机/降档的可观察信号",
    traps: "特有坑",
    trapsGloss: "你这类结构在这件事上特别容易反复栽的行为陷阱",
    switchBackup: "切辅开关",
    switchBackupGloss: "主路径谈不拢时，切到辅路径的触发条件",
    protection: "防护法则",
    protectionGloss: "为保住主路径必须守住的底线",
    riskSit: "出现",
    riskDo: "该做",
    riskWatch: "注意",
    riskForbid: "禁做",
    boundaryScript: "边界短句",
    before: "之前",
    after: "之后",
    alert: "注意",
    weekTpl: "第{n}周",
    evidencePrimary: "展开【主方案】底层依据",
    evidenceBackup: "展开【辅方案】底层依据",
    evidenceJudgment: "展开 · 判定底层依据",
    evidenceForTpl: "展开 · {title}的底层依据",
    evidenceWhyTpl: "你为什么能这么做 · {title}",
  },
  en: {
    coreJudgment: "Core judgment",
    primary: "Primary",
    backup: "Backup",
    primaryBadge: "Preferred · breakthrough track",
    backupBadge: "Fallback · stop-loss track",
    matrixTitle: "Primary vs backup matrix",
    matrixDim: "Dimension",
    matrixGoal: "Strategic goal",
    matrixBody: "Body load",
    matrixRisk: "Field risk",
    matrixWhen: "Trigger",
    coreLogic: "Core play",
    why: "Why",
    when: "When",
    whenBackup: "Trigger",
    chip: "Breakthrough chip",
    dims: "Execution load",
    dimsHint: "How much body, mind, and field this path demands",
    body: "Body",
    mind: "Mind",
    field: "Field",
    dimBody: { high: "High load", mid: "Mid load", low: "Low load", unknown: "n/a" },
    dimMind: { high: "High load", mid: "Mid", low: "Low load", unknown: "n/a" },
    dimField: {
      high: "High friction",
      mid: "Mid friction",
      low: "Low friction",
      unknown: "n/a",
    },
    riskLabel: {
      high: "High risk",
      mid: "Mid risk",
      low: "Very low risk",
      unknown: "—",
    },
    surface: "Surface",
    essence: "Essence",
    dashboard: "True dashboard",
    strategy: "Strategy",
    means: "Actions",
    angle: "Angle",
    angleGloss: "",
    primaryTrackGloss: "Science playbook angles for the primary path",
    backupTrackGloss: "Science playbook angles when primary stalls",
    dimension: "Field lever",
    dimensionGloss: "",
    anchorTitle: "Anchor · question & expectation",
    anchorShort: "Question & expectation",
    anchorGloss: "This page serves this matter only — no dual tracks",
    leverage: "Leverage",
    leverageGloss: "Asymmetric levers you can borrow",
    avoid: "Avoid",
    avoidGloss: "Eastern / field traps to sidestep",
    fieldMatrix: "Field matrix",
    fieldMatrixGloss: "Quick field snapshot",
    day7: "7-day micro checklist",
    day7Gloss: "Checkable near-term cards: action, why this week, done-when",
    identityGloss: "See the role shift — and why it must land",
    identityShiftLabel: "Why this shift",
    quoteTitle: "Steadying line",
    quoteGloss: "One line to steady the wobble",
    quoteUseLabel: "When to use it",
    tonight: "Tonight · one thing",
    tonightGloss: "One loop: do · done looks like · why tonight",
    tonightDoneLabel: "Done looks like",
    tonightWhyLabel: "Why tonight",
    day7WhyLabel: "Why this week",
    day7DoneLabel: "Tick when",
    takeaways: "Three takeaways",
    takeawaysGloss:
      "Decision · week lever · fuse — three seals, not a summary wall",
    script: "Script",
    metrics: "Metrics",
    leverageMark: "Use",
    avoidMark: "Skip",
    question: "Question",
    desired: "Desired outcome",
    bridgeNote:
      "This page diagnoses each real collecting surface; how-to lives on later playbook / self-retune pages.",
    redLights: "Red lights",
    redLightsGloss:
      "Observable stop signals — pause or downshift when these fire",
    traps: "Traps",
    trapsGloss: "Failure modes this structure tends to repeat on this issue",
    switchBackup: "Switch to backup",
    switchBackupGloss: "When to freeze the primary path and flip to backup",
    protection: "Protection rules",
    protectionGloss: "Baselines that keep the primary path alive",
    riskSit: "Signal",
    riskDo: "Do",
    riskWatch: "Watch",
    riskForbid: "Don't",
    boundaryScript: "Boundary line",
    before: "Before",
    after: "After",
    alert: "Alert",
    weekTpl: "Week {n}",
    evidencePrimary: "Expand · primary underlying basis",
    evidenceBackup: "Expand · backup underlying basis",
    evidenceJudgment: "Expand · judgment basis",
    evidenceForTpl: "Expand · underlying basis for {title}",
    evidenceWhyTpl: "Why this holds for you · {title}",
  },
  es: {
    coreJudgment: "Juicio central",
    primary: "Principal",
    backup: "Reserva",
    primaryBadge: "Preferida · vía de ruptura",
    backupBadge: "Reserva · vía de contención",
    matrixTitle: "Comparación de vías principal y reserva",
    matrixDim: "Dimensión",
    matrixGoal: "Objetivo estratégico",
    matrixBody: "Carga corporal",
    matrixRisk: "Riesgo de campo",
    matrixWhen: "Disparador",
    coreLogic: "Jugada central",
    why: "Por qué",
    when: "Cuándo",
    whenBackup: "Disparador",
    chip: "Ficha de ruptura",
    dims: "Carga de ejecución",
    dimsHint: "Cuánto exigen cuerpo, mente y campo en esta vía",
    body: "Cuerpo",
    mind: "Mente",
    field: "Campo",
    dimBody: {
      high: "Carga alta",
      mid: "Carga media",
      low: "Carga baja",
      unknown: "n/d",
    },
    dimMind: {
      high: "Carga alta",
      mid: "Media",
      low: "Carga baja",
      unknown: "n/d",
    },
    dimField: {
      high: "Fricción alta",
      mid: "Fricción media",
      low: "Fricción baja",
      unknown: "n/d",
    },
    riskLabel: {
      high: "Riesgo alto",
      mid: "Riesgo medio",
      low: "Riesgo muy bajo",
      unknown: "—",
    },
    surface: "Superficie",
    essence: "Esencia",
    dashboard: "Panel real",
    strategy: "Estrategia",
    means: "Acciones",
    angle: "Ángulo",
    angleGloss: "",
    primaryTrackGloss: "Ángulos de playbook científico para la vía principal",
    backupTrackGloss: "Ángulos de playbook cuando la principal se atasca",
    dimension: "Palanca de campo",
    dimensionGloss: "",
    anchorTitle: "Ancla · pregunta y expectativa",
    anchorShort: "Pregunta y expectativa",
    anchorGloss: "Esta página sirve solo a este asunto — sin doble vía",
    leverage: "Apalancamiento",
    leverageGloss: "Palancas asimétricas que puedes usar",
    avoid: "Evitar",
    avoidGloss: "Trampas de campo a eludir en este caso",
    fieldMatrix: "Matriz de campo",
    fieldMatrixGloss: "Instantánea rápida de campo",
    day7: "Microlista de 7 días",
    day7Gloss: "Tarjetas cercanas: acción, por qué esta semana, hecho cuando",
    identityGloss: "Ve el cambio de rol — y por qué debe aterrizar",
    identityShiftLabel: "Por qué este cambio",
    quoteTitle: "Línea de anclaje",
    quoteGloss: "Una línea para estabilizar la vacilación",
    quoteUseLabel: "Cuándo usarla",
    tonight: "Esta noche · una cosa",
    tonightGloss: "Un ciclo: hacer · se ve hecho · por qué esta noche",
    tonightDoneLabel: "Se ve hecho",
    tonightWhyLabel: "Por qué esta noche",
    day7WhyLabel: "Por qué esta semana",
    day7DoneLabel: "Marcar cuando",
    takeaways: "Tres para llevar",
    takeawaysGloss:
      "Decisión · palanca de la semana · fusible — tres sellos, no un muro",
    script: "Guion",
    metrics: "Métricas",
    leverageMark: "Usar",
    avoidMark: "Omitir",
    question: "Pregunta",
    desired: "Resultado deseado",
    bridgeNote:
      "Esta página diagnostica cada superficie real recogida; el cómo hacer está en las páginas de estrategia / autoajuste.",
    redLights: "Luces rojas",
    redLightsGloss:
      "Señales observables de parada — pausa o reduce cuando salten",
    traps: "Trampas",
    trapsGloss:
      "Modos de fallo que esta estructura tiende a repetir en este asunto",
    switchBackup: "Cambiar a reserva",
    switchBackupGloss: "Cuándo congelar la principal y pasar a la reserva",
    protection: "Reglas de protección",
    protectionGloss: "Líneas base que mantienen viva la vía principal",
    riskSit: "Señal",
    riskDo: "Hacer",
    riskWatch: "Cuidado",
    riskForbid: "No hacer",
    boundaryScript: "Línea de límite",
    before: "Antes",
    after: "Después",
    alert: "Aviso",
    weekTpl: "Semana {n}",
    evidencePrimary: "Expandir · base subyacente principal",
    evidenceBackup: "Expandir · base subyacente de reserva",
    evidenceJudgment: "Expandir · base del juicio",
    evidenceForTpl: "Expandir · base subyacente de {title}",
    evidenceWhyTpl: "Por qué puedes hacerlo · {title}",
  },
  fr: {
    coreJudgment: "Jugement central",
    primary: "Principale",
    backup: "Secours",
    primaryBadge: "Préférée · voie de rupture",
    backupBadge: "Secours · voie de containment",
    matrixTitle: "Comparaison principale / secours",
    matrixDim: "Dimension",
    matrixGoal: "Objectif stratégique",
    matrixBody: "Charge corporelle",
    matrixRisk: "Risque de terrain",
    matrixWhen: "Déclencheur",
    coreLogic: "Jeu central",
    why: "Pourquoi",
    when: "Quand",
    whenBackup: "Déclencheur",
    chip: "Jeton de rupture",
    dims: "Charge d'exécution",
    dimsHint: "Combien corps, esprit et terrain demandent sur cette voie",
    body: "Corps",
    mind: "Esprit",
    field: "Terrain",
    dimBody: {
      high: "Charge haute",
      mid: "Charge moyenne",
      low: "Charge basse",
      unknown: "n/d",
    },
    dimMind: {
      high: "Charge haute",
      mid: "Moyen",
      low: "Charge basse",
      unknown: "n/d",
    },
    dimField: {
      high: "Friction haute",
      mid: "Friction moyenne",
      low: "Friction basse",
      unknown: "n/d",
    },
    riskLabel: {
      high: "Risque élevé",
      mid: "Risque moyen",
      low: "Risque très bas",
      unknown: "—",
    },
    surface: "Surface",
    essence: "Essence",
    dashboard: "Tableau réel",
    strategy: "Stratégie",
    means: "Actions",
    angle: "Angle",
    angleGloss: "",
    primaryTrackGloss: "Angles playbook scientifiques pour la voie principale",
    backupTrackGloss: "Angles playbook quand la principale bloque",
    dimension: "Levier de terrain",
    dimensionGloss: "",
    anchorTitle: "Ancrage · question et attente",
    anchorShort: "Question et attente",
    anchorGloss: "Cette page ne sert que ce sujet — pas de double voie",
    leverage: "Levier",
    leverageGloss: "Leviers asymétriques que vous pouvez emprunter",
    avoid: "Éviter",
    avoidGloss: "Pièges de terrain à contourner dans ce dossier",
    fieldMatrix: "Matrice de terrain",
    fieldMatrixGloss: "Instantané rapide du terrain",
    day7: "Micro-liste 7 jours",
    day7Gloss: "Cartes proches : action, pourquoi cette semaine, fait quand",
    identityGloss: "Voyez le changement de rôle — et pourquoi il doit tenir",
    identityShiftLabel: "Pourquoi ce changement",
    quoteTitle: "Ligne d'ancrage",
    quoteGloss: "Une ligne pour stabiliser l'hésitation",
    quoteUseLabel: "Quand l'utiliser",
    tonight: "Ce soir · une chose",
    tonightGloss: "Une boucle : faire · fait ressemble · pourquoi ce soir",
    tonightDoneLabel: "Fait ressemble",
    tonightWhyLabel: "Pourquoi ce soir",
    day7WhyLabel: "Pourquoi cette semaine",
    day7DoneLabel: "Cocher quand",
    takeaways: "Trois à emporter",
    takeawaysGloss:
      "Décision · levier de la semaine · fusible — trois sceaux, pas un mur",
    script: "Script",
    metrics: "Indicateurs",
    leverageMark: "Utiliser",
    avoidMark: "Passer",
    question: "Question",
    desired: "Résultat souhaité",
    bridgeNote:
      "Cette page diagnostique chaque surface réelle collectée ; le comment-faire est sur les pages stratégie / auto-réglage.",
    redLights: "Feux rouges",
    redLightsGloss:
      "Signaux d'arrêt observables — pausez ou rétrogradez quand ils s'allument",
    traps: "Pièges",
    trapsGloss:
      "Modes d'échec que cette structure tend à répéter sur ce sujet",
    switchBackup: "Passer au secours",
    switchBackupGloss: "Quand geler la principale et basculer au secours",
    protection: "Règles de protection",
    protectionGloss: "Bases qui maintiennent la voie principale vivante",
    riskSit: "Signal",
    riskDo: "Faire",
    riskWatch: "Attention",
    riskForbid: "Ne pas faire",
    boundaryScript: "Ligne de limite",
    before: "Avant",
    after: "Après",
    alert: "Alerte",
    weekTpl: "Semaine {n}",
    evidencePrimary: "Développer · base sous-jacente principale",
    evidenceBackup: "Développer · base sous-jacente de secours",
    evidenceJudgment: "Développer · base du jugement",
    evidenceForTpl: "Développer · base sous-jacente pour {title}",
    evidenceWhyTpl: "Pourquoi vous pouvez le faire · {title}",
  },
};

export function deliverySlotUiCopy(locale: string): DeliverySlotUiCopy {
  const b = deliveryLocaleBucket(locale);
  const pack = BY_LOCALE[b === "de" ? "en" : b];
  const { weekTpl, evidenceForTpl, evidenceWhyTpl, ...rest } = pack;
  return {
    ...rest,
    week: (n: number) => weekTpl.replace("{n}", String(n)),
    evidenceFor: (title: string) => evidenceForTpl.replace("{title}", title),
    evidenceWhy: (title: string) => evidenceWhyTpl.replace("{title}", title),
  };
}
