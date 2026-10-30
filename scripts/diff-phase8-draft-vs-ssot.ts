/**
 * Diff handoff 08 draft (A+B) against live POJU_TERMS.
 * Does NOT merge into SSOT — product confirmation required for copy deltas.
 *
 *   pnpm exec node ./node_modules/tsx/dist/cli.mjs scripts/diff-phase8-draft-vs-ssot.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POJU_TERMS, type TermLocale } from "../lib/glossary/pojulife-terms";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "lib", "glossary", "phase8-draft-review.json");
const LOCALES: TermLocale[] = ["zh", "en", "es", "de", "fr"];

/** Verbatim from Desktop handoff 08-新增自造术语五语草案.md §A+§B */
const DRAFT: Record<
  string,
  {
    ns: "qimen" | "ziwei";
    traditional: string;
    term: Record<TermLocale, string>;
    definition: Record<TermLocale, string>;
  }
> = {
  qm_cycle_anchor: {
    ns: "qimen",
    traditional: "旬首",
    term: {
      zh: "周期锚点",
      en: "Cycle Anchor",
      es: "Ancla del Ciclo",
      de: "Zyklusanker",
      fr: "Ancrage du Cycle",
    },
    definition: {
      zh: "用于定位当前盘局所处六十甲子分段的结构索引，不代表事件结果。",
      en: "A structural index locating the current chart within a sexagenary cycle segment; it does not predict an outcome.",
      es: "Un índice estructural que sitúa el esquema actual dentro de un segmento del ciclo sexagenario; no predice resultados.",
      de: "Ein Strukturindex zur Einordnung des aktuellen Charts in einen Abschnitt des Sexagenärzyklus; er sagt keine Ergebnisse voraus.",
      fr: "Un indice structurel qui situe le thème actuel dans un segment du cycle sexagésimal ; il ne prédit aucun résultat.",
    },
  },
  qm_coverage_gap: {
    ns: "qimen",
    traditional: "空亡",
    term: {
      zh: "覆盖缺口",
      en: "Coverage Gap",
      es: "Brecha de Cobertura",
      de: "Abdeckungslücke",
      fr: "Lacune de Couverture",
    },
    definition: {
      zh: "标记当前盘局中某些位置未形成常规承载关系的区域，用于提示信息覆盖边界。",
      en: "Marks areas in the chart where ordinary support relationships are absent, indicating a limit in structural coverage.",
      es: "Señala zonas del esquema donde faltan relaciones habituales de soporte e indica un límite de cobertura estructural.",
      de: "Kennzeichnet Bereiche im Chart ohne übliche Stützbeziehungen und weist auf eine Grenze der strukturellen Abdeckung hin.",
      fr: "Signale les zones du thème où les relations habituelles de soutien sont absentes et indique une limite de couverture structurelle.",
    },
  },
  qm_mobility_marker: {
    ns: "qimen",
    traditional: "驿马",
    term: {
      zh: "移动标记",
      en: "Mobility Marker",
      es: "Indicador de Movilidad",
      de: "Mobilitätsmarker",
      fr: "Indicateur de Mobilité",
    },
    definition: {
      zh: "标识盘局中与移动、切换或位置变化相关的结构信号，不表示必然迁移。",
      en: "Identifies a chart signal associated with movement, transition, or change of position; it does not imply inevitable relocation.",
      es: "Identifica una señal del esquema asociada con movimiento, transición o cambio de posición; no implica una mudanza inevitable.",
      de: "Kennzeichnet ein Chartsignal für Bewegung, Übergang oder Positionswechsel; es bedeutet keinen zwangsläufigen Umzug.",
      fr: "Identifie un signal du thème lié au mouvement, à la transition ou au changement de position ; il n'implique pas un déménagement inévitable.",
    },
  },
  qm_seasonal_pivot: {
    ns: "qimen",
    traditional: "节气",
    term: {
      zh: "季节点",
      en: "Seasonal Pivot",
      es: "Punto de Giro Estacional",
      de: "Saisonaler Wendepunkt",
      fr: "Point de Bascule Saisonnier",
    },
    definition: {
      zh: "表示排盘计算所采用的季节分界节点，用于确定历法与盘局参数。",
      en: "The seasonal boundary used by the chart calculation to determine calendar and configuration parameters.",
      es: "El límite estacional utilizado por el cálculo para determinar los parámetros del calendario y del esquema.",
      de: "Der saisonale Grenzpunkt, den die Berechnung zur Bestimmung von Kalender- und Konfigurationsparametern verwendet.",
      fr: "La limite saisonnière utilisée par le calcul pour déterminer les paramètres calendaires et ceux du thème.",
    },
  },
  qm_configuration_index: {
    ns: "qimen",
    traditional: "局数",
    term: {
      zh: "盘式索引",
      en: "Configuration Index",
      es: "Índice de Configuración",
      de: "Konfigurationsindex",
      fr: "Indice de Configuration",
    },
    definition: {
      zh: "标识当前奇门盘采用的九宫配置编号，不是个人能力或吉凶评分。",
      en: "Identifies the nine-palace configuration number used by the current Qimen chart; it is not a personal rating.",
      es: "Identifica el número de configuración de nueve palacios utilizado por el esquema Qimen; no es una calificación personal.",
      de: "Gibt die Nummer der Neun-Paläste-Konfiguration des aktuellen Qimen-Charts an; es ist keine persönliche Bewertung.",
      fr: "Indique le numéro de configuration des neuf palais utilisé par le thème Qimen ; ce n'est pas une évaluation personnelle.",
    },
  },
  qm_elemental_phase_profile: {
    ns: "qimen",
    traditional: "旺相休囚死",
    term: {
      zh: "元素阶段谱",
      en: "Elemental Phase Profile",
      es: "Perfil de Fases Elementales",
      de: "Elementarphasenprofil",
      fr: "Profil des Phases Élémentaires",
    },
    definition: {
      zh: "描述五类元素在当前历法阶段中的相对状态，是传统模型分类，不是物理能量测量。",
      en: "Describes the relative states of five elements in the current calendrical phase; it is a traditional model classification, not a physical energy measurement.",
      es: "Describe los estados relativos de los cinco elementos en la fase calendárica actual; es una clasificación tradicional, no una medición física de energía.",
      de: "Beschreibt die relativen Zustände der fünf Elemente in der aktuellen Kalenderphase; es handelt sich um eine traditionelle Modellklassifikation, nicht um eine physikalische Energiemessung.",
      fr: "Décrit les états relatifs des cinq éléments dans la phase calendaire actuelle ; il s'agit d'une classification traditionnelle, et non d'une mesure physique de l'énergie.",
    },
  },
  zw_identity_field: {
    ns: "ziwei",
    traditional: "命宫",
    term: {
      zh: "核心定位域",
      en: "Core Identity Field",
      es: "Campo de Identidad Central",
      de: "Zentrales Identitätsfeld",
      fr: "Champ d'Identité Centrale",
    },
    definition: {
      zh: "用于组织个人结构信息的中心参考领域，不等同于固定人格结论。",
      en: "The central reference domain for organizing personal structural information; it is not a fixed personality verdict.",
      es: "El ámbito de referencia central para organizar información estructural personal; no constituye un diagnóstico fijo de personalidad.",
      de: "Der zentrale Bezugsbereich zur Ordnung persönlicher Strukturdaten; er ist kein festes Persönlichkeitsurteil.",
      fr: "Le domaine de référence central qui organise les informations structurelles personnelles ; il ne constitue pas un verdict fixe sur la personnalité.",
    },
  },
  zw_opposite_field: {
    ns: "ziwei",
    traditional: "对宫",
    term: {
      zh: "对照定位域",
      en: "Counterpart Field",
      es: "Campo de Contraste",
      de: "Gegenüberliegendes Feld",
      fr: "Champ de Correspondance",
    },
    definition: {
      zh: "与核心定位域形成对照关系的参考领域，用于观察互补与张力。",
      en: "A reference domain paired with the core field to examine complementarity and tension.",
      es: "Un ámbito de referencia vinculado al campo central para observar complementariedades y tensiones.",
      de: "Ein Bezugsbereich, der dem Kernfeld gegenübergestellt wird, um Ergänzungen und Spannungen zu betrachten.",
      fr: "Un domaine de référence mis en regard du champ central afin d'observer complémentarités et tensions.",
    },
  },
  zw_life_domains: {
    ns: "ziwei",
    traditional: "十二宫",
    term: {
      zh: "生活领域图谱",
      en: "Life-Domain Map",
      es: "Mapa de Ámbitos Vitales",
      de: "Lebensbereichslandkarte",
      fr: "Carte des Domaines de Vie",
    },
    definition: {
      zh: "将不同生活主题组织为十二个结构领域的索引，不代表事件必然发生。",
      en: "An index organizing life themes into twelve structural domains; it does not imply that events will occur.",
      es: "Un índice que organiza los temas de vida en doce ámbitos estructurales; no implica que ocurran determinados acontecimientos.",
      de: "Ein Index, der Lebensthemen in zwölf strukturelle Bereiche gliedert; er bedeutet nicht, dass bestimmte Ereignisse eintreten.",
      fr: "Un index qui organise les thèmes de vie en douze domaines structurels ; il ne signifie pas que des événements se produiront.",
    },
  },
  zw_four_shift_modes: {
    ns: "ziwei",
    traditional: "四化",
    term: {
      zh: "四向转化",
      en: "Four Shift Modes",
      es: "Cuatro Modos de Transformación",
      de: "Vier Wandlungsmodi",
      fr: "Quatre Modes de Transformation",
    },
    definition: {
      zh: "将结构关系分为资源、主动权、认可与摩擦四种变化方向的传统分类。",
      en: "A traditional classification of four change directions: resources, agency, recognition, and friction.",
      es: "Una clasificación tradicional de cuatro direcciones de cambio: recursos, capacidad de acción, reconocimiento y fricción.",
      de: "Eine traditionelle Einteilung in vier Veränderungsrichtungen: Ressourcen, Handlungsmacht, Anerkennung und Reibung.",
      fr: "Une classification traditionnelle de quatre directions de changement : ressources, pouvoir d'agir, reconnaissance et friction.",
    },
  },
  zw_resource_shift: {
    ns: "ziwei",
    traditional: "化禄",
    term: {
      zh: "资源转化",
      en: "Resource Shift",
      es: "Transformación de Recursos",
      de: "Ressourcenwandel",
      fr: "Transformation des Ressources",
    },
    definition: {
      zh: "描述某项结构关系如何关联资源获取、支持或流动。",
      en: "Describes how a structural relationship relates to the access, support, or flow of resources.",
      es: "Describe cómo una relación estructural se vincula con el acceso, el apoyo o el flujo de recursos.",
      de: "Beschreibt, wie eine Strukturbeziehung mit Zugang, Unterstützung oder Fluss von Ressourcen zusammenhängt.",
      fr: "Décrit comment une relation structurelle se rapporte à l'accès, au soutien ou à la circulation des ressources.",
    },
  },
  zw_agency_shift: {
    ns: "ziwei",
    traditional: "化权",
    term: {
      zh: "主动权转化",
      en: "Agency Shift",
      es: "Transformación de la Capacidad de Acción",
      de: "Wandel der Handlungsmacht",
      fr: "Transformation du Pouvoir d'Agir",
    },
    definition: {
      zh: "描述某项结构关系如何关联影响力、主导权与行动控制。",
      en: "Describes how a structural relationship relates to influence, initiative, and control over action.",
      es: "Describe cómo una relación estructural se relaciona con la influencia, la iniciativa y el control de la acción.",
      de: "Beschreibt, wie eine Strukturbeziehung mit Einfluss, Initiative und Handlungskontrolle zusammenhängt.",
      fr: "Décrit comment une relation structurelle se rapporte à l'influence, à l'initiative et au contrôle de l'action.",
    },
  },
  zw_recognition_shift: {
    ns: "ziwei",
    traditional: "化科",
    term: {
      zh: "认可转化",
      en: "Recognition Shift",
      es: "Transformación del Reconocimiento",
      de: "Anerkennungswandel",
      fr: "Transformation de la Reconnaissance",
    },
    definition: {
      zh: "描述某项结构关系如何关联表达、专业呈现与外部认可。",
      en: "Describes how a structural relationship relates to expression, professional presentation, and external recognition.",
      es: "Describe cómo una relación estructural se vincula con la expresión, la presentación profesional y el reconocimiento externo.",
      de: "Beschreibt, wie eine Strukturbeziehung mit Ausdruck, professioneller Darstellung und äußerer Anerkennung zusammenhängt.",
      fr: "Décrit comment une relation structurelle se rapporte à l'expression, à la présentation professionnelle et à la reconnaissance extérieure.",
    },
  },
  zw_friction_shift: {
    ns: "ziwei",
    traditional: "化忌",
    term: {
      zh: "摩擦转化",
      en: "Friction Shift",
      es: "Transformación de la Fricción",
      de: "Reibungswandel",
      fr: "Transformation des Frottements",
    },
    definition: {
      zh: "描述某项结构关系中较容易出现阻力、反复或协调成本的方向。",
      en: "Describes the direction in which a structural relationship may involve resistance, repetition, or coordination costs.",
      es: "Describe la dirección en la que una relación estructural puede implicar resistencia, repetición o costes de coordinación.",
      de: "Beschreibt die Richtung, in der eine Strukturbeziehung Widerstand, Wiederholungen oder Koordinationskosten mit sich bringen kann.",
      fr: "Décrit la direction dans laquelle une relation structurelle peut impliquer résistance, répétition ou coûts de coordination.",
    },
  },
  zw_long_cycle: {
    ns: "ziwei",
    traditional: "大限",
    term: {
      zh: "长周期段",
      en: "Long-Cycle Phase",
      es: "Fase de Ciclo Largo",
      de: "Langzyklusphase",
      fr: "Phase de Cycle Long",
    },
    definition: {
      zh: "表示紫微结构模型中按年龄划分的一段较长周期，不构成未来事件预测。",
      en: "A longer age-bounded phase in the Ziwei structural model; it is not a prediction of future events.",
      es: "Una fase de mayor duración delimitada por edad en el modelo estructural Ziwei; no predice acontecimientos futuros.",
      de: "Eine längere, altersbezogene Phase im Ziwei-Strukturmodell; sie sagt keine zukünftigen Ereignisse voraus.",
      fr: "Une phase plus longue, délimitée par l'âge, dans le modèle structurel Ziwei ; elle ne prédit pas d'événements futurs.",
    },
  },
  zw_yearly_cycle: {
    ns: "ziwei",
    traditional: "流年",
    term: {
      zh: "年度周期",
      en: "Yearly Cycle",
      es: "Ciclo Anual",
      de: "Jahreszyklus",
      fr: "Cycle Annuel",
    },
    definition: {
      zh: "用于标记当前分析年份的结构索引，不代表该年必然发生特定事件。",
      en: "A structural index for the year being analyzed; it does not imply that specific events will occur.",
      es: "Un índice estructural del año analizado; no implica que ocurran acontecimientos concretos.",
      de: "Ein Strukturindex für das analysierte Jahr; er bedeutet nicht, dass bestimmte Ereignisse eintreten.",
      fr: "Un indice structurel de l'année analysée ; il n'implique pas que des événements précis se produiront.",
    },
  },
  zw_core_driver: {
    ns: "ziwei",
    traditional: "命主",
    term: {
      zh: "核心驱动",
      en: "Core Driver",
      es: "Impulsor Central",
      de: "Kernantrieb",
      fr: "Moteur Central",
    },
    definition: {
      zh: "用于标记个人结构模型中的核心驱动角色，不是对个人能力的客观测量。",
      en: "Marks a core-driver role in the personal structural model; it is not an objective measurement of ability.",
      es: "Señala una función impulsora central en el modelo estructural personal; no mide objetivamente la capacidad.",
      de: "Kennzeichnet eine zentrale Antriebsrolle im persönlichen Strukturmodell; es ist keine objektive Fähigkeitsmessung.",
      fr: "Désigne un rôle moteur central dans le modèle structurel personnel ; il ne mesure pas objectivement les capacités.",
    },
  },
  zw_action_driver: {
    ns: "ziwei",
    traditional: "身主",
    term: {
      zh: "行动驱动",
      en: "Action Driver",
      es: "Impulsor de Acción",
      de: "Handlungsantrieb",
      fr: "Moteur d'Action",
    },
    definition: {
      zh: "用于标记结构模型中与行动方式相关的驱动角色，不等同于实际行为表现。",
      en: "Marks a driver associated with action style in the structural model; it is not the same as observed behavior.",
      es: "Señala un impulsor relacionado con el estilo de acción en el modelo; no equivale a la conducta observada.",
      de: "Kennzeichnet einen mit dem Handlungsstil verbundenen Antrieb im Modell; er ist nicht mit beobachtetem Verhalten gleichzusetzen.",
      fr: "Désigne un moteur associé au style d'action dans le modèle ; il ne correspond pas au comportement observé.",
    },
  },
  zw_action_domain: {
    ns: "ziwei",
    traditional: "身宫",
    term: {
      zh: "行动落点域",
      en: "Action Domain",
      es: "Ámbito de Acción",
      de: "Handlungsbereich",
      fr: "Domaine d'Action",
    },
    definition: {
      zh: "标记个人结构信息中与行动实践关联的领域位置。",
      en: "Marks the domain associated with the practical expression of action in the personal structure.",
      es: "Señala el ámbito asociado con la expresión práctica de la acción en la estructura personal.",
      de: "Kennzeichnet den Bereich, der mit der praktischen Umsetzung von Handlungen in der persönlichen Struktur verbunden ist.",
      fr: "Désigne le domaine associé à l'expression concrète de l'action dans la structure personnelle.",
    },
  },
  zw_elemental_configuration: {
    ns: "ziwei",
    traditional: "五行局",
    term: {
      zh: "元素配置型",
      en: "Elemental Configuration",
      es: "Configuración Elemental",
      de: "Elementarkonfiguration",
      fr: "Configuration Élémentaire",
    },
    definition: {
      zh: "描述紫微排盘所采用的五元素分类配置，不是科学测得的物质属性。",
      en: "Describes the five-element classification used by the Ziwei chart; it is not a scientifically measured physical property.",
      es: "Describe la clasificación de cinco elementos utilizada por el esquema Ziwei; no es una propiedad física medida científicamente.",
      de: "Beschreibt die Fünf-Elemente-Klassifikation des Ziwei-Charts; es handelt sich nicht um eine wissenschaftlich gemessene physikalische Eigenschaft.",
      fr: "Décrit la classification des cinq éléments utilisée par le thème Ziwei ; il ne s'agit pas d'une propriété physique mesurée scientifiquement.",
    },
  },
};

type Delta = Partial<Record<TermLocale, { draft: string; live: string }>>;

function main() {
  const rows = [];
  for (const [slug, d] of Object.entries(DRAFT)) {
    const live = POJU_TERMS.find((t) => t.slug === slug);
    if (!live) {
      rows.push({
        slug,
        ns: d.ns,
        traditional: d.traditional,
        status: "missing_from_ssot" as const,
        review: "product_confirm_then_merge",
      });
      continue;
    }
    const term_delta: Delta = {};
    const def_delta: Delta = {};
    for (const loc of LOCALES) {
      const lt = (live.term[loc] || "").trim();
      const dt = (d.term[loc] || "").trim();
      if (lt !== dt) term_delta[loc] = { draft: dt, live: lt };
      const ld = (live.definition[loc] || "").trim();
      const dd = (d.definition[loc] || "").trim();
      if (ld !== dd) def_delta[loc] = { draft: dd, live: ld };
    }
    const hasDelta =
      Object.keys(term_delta).length > 0 || Object.keys(def_delta).length > 0;
    rows.push({
      slug,
      ns: live.ns,
      traditional: live.traditional,
      polarity: live.polarity,
      status: hasDelta
        ? ("landed_with_copy_delta" as const)
        : ("landed_exact_match" as const),
      review: hasDelta
        ? "product_confirm_copy_overwrite_or_keep_live"
        : "no_action_already_merged",
      term_delta,
      def_delta,
    });
  }

  const report = {
    generated_at: new Date().toISOString(),
    source: "Desktop/POJU-terms-implementation-handoff/08-新增自造术语五语草案.md",
    policy:
      "Draft is product-candidate only. Do not invent 14 main stars / 12 palace names. Sexagenary 60 and compound markers stay out (§C).",
    summary: {
      total_draft_ab: rows.length,
      landed_exact_match: rows.filter((r) => r.status === "landed_exact_match")
        .length,
      landed_with_copy_delta: rows.filter(
        (r) => r.status === "landed_with_copy_delta",
      ).length,
      missing_from_ssot: rows.filter((r) => r.status === "missing_from_ssot")
        .length,
    },
    section_c_deferred: [
      "六十甲子 ×60 — closed-set algorithm only",
      "伤官见官 / 枭神夺食 — marker soft path, no parallel coined terms",
      "紫微 14 主星 + 十二宫具体名 — collect from iztro inventory then name",
      "神煞 51 — disposition done in Phase 4; redline has no public coined term",
    ],
    rows,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  console.log("\n========== phase8 draft vs SSOT ==========\n");
  console.log(JSON.stringify(report.summary, null, 2));
  const deltas = rows.filter((r) => r.status === "landed_with_copy_delta");
  if (deltas.length) {
    console.log("\ncopy deltas (need product confirm before overwrite):");
    for (const r of deltas) {
      console.log(
        `  ${r.slug} term[${Object.keys(r.term_delta).join(",")}] def[${Object.keys(r.def_delta).join(",")}]`,
      );
    }
  } else {
    console.log("\nAll A+B draft rows already match live SSOT term+definition.");
  }
  console.log(`\nwrote ${path.relative(ROOT, OUT)}\n`);
}

main();
