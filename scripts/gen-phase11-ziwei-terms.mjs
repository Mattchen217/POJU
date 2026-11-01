/**
 * One-shot generator: Phase 11 ziwei SSOT fragment → stdout / tmp file.
 * Run: node scripts/gen-phase11-ziwei-terms.mjs
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** @typedef {{ zh: string, en: string, es: string, de: string, fr: string }} L5 */

/** @type {Array<{ traditional: string, slug: string, term: L5, definition: L5 }>} */
const entries = [
  {
    traditional: "兄弟",
    slug: "zw_peer_bond_field",
    term: {
      zh: "同辈联结域",
      en: "Peer Bond Field",
      es: "Campo de vínculo entre pares",
      de: "Peer-Bindungsfeld",
      fr: "Champ de lien entre pairs",
    },
    definition: {
      zh: "标记与同辈协作、对照与边界相关的结构领域，不预测具体人际关系事件。",
      en: "Names a structural domain for peer collaboration, contrast, and boundaries; it does not predict specific relationship events.",
      es: "Nombra un ámbito estructural de colaboración entre pares, contraste y límites; no predice hechos concretos de relación.",
      de: "Bezeichnet einen strukturellen Bereich für Peer-Zusammenarbeit, Kontrast und Grenzen; sagt keine konkreten Beziehungseignisse voraus.",
      fr: "Désigne un domaine structurel de collaboration entre pairs, de contraste et de limites ; il ne prédit pas d'événements relationnels concrets.",
    },
  },
  {
    traditional: "夫妻",
    slug: "zw_partnership_field",
    term: {
      zh: "伙伴关系域",
      en: "Partnership Field",
      es: "Campo de asociación",
      de: "Partnerschaftsfeld",
      fr: "Champ de partenariat",
    },
    definition: {
      zh: "标记深度伙伴协作与契约张力的结构领域，不等于婚姻结果判定。",
      en: "Names a structural domain for deep partnership and contractual tension; it is not a marriage-outcome verdict.",
      es: "Nombra un ámbito estructural de asociación profunda y tensión contractual; no es un veredicto sobre el matrimonio.",
      de: "Bezeichnet einen strukturellen Bereich für tiefe Partnerschaft und Vertragsspannung; kein Ehe-Ergebnisurteil.",
      fr: "Désigne un domaine structurel de partenariat profond et de tension contractuelle ; ce n'est pas un verdict marital.",
    },
  },
  {
    traditional: "子女",
    slug: "zw_continuity_field",
    term: {
      zh: "延续创造域",
      en: "Continuity Field",
      es: "Campo de continuidad",
      de: "Kontinuitätsfeld",
      fr: "Champ de continuité",
    },
    definition: {
      zh: "标记创造、延续与后代主题相关的结构领域，不宣称生育必然。",
      en: "Names a structural domain around creation, continuity, and legacy themes; it does not assert fertility outcomes.",
      es: "Nombra un ámbito estructural de creación, continuidad y legado; no afirma resultados de fertilidad.",
      de: "Bezeichnet einen strukturellen Bereich zu Schöpfung, Kontinuität und Weitergabe; behauptet keine Fruchtbarkeitsfolgen.",
      fr: "Désigne un domaine structurel de création, de continuité et de transmission ; il n'affirme pas de résultat de fertilité.",
    },
  },
  {
    traditional: "财帛",
    slug: "zw_resource_flow_field",
    term: {
      zh: "资源流转域",
      en: "Resource Flow Field",
      es: "Campo de flujo de recursos",
      de: "Ressourcenflussfeld",
      fr: "Champ de flux de ressources",
    },
    definition: {
      zh: "标记资源进出与配置节奏的结构领域，不是财富预测。",
      en: "Names a structural domain for resource inflow, outflow, and allocation rhythm; it is not a wealth forecast.",
      es: "Nombra un ámbito estructural del ritmo de entrada, salida y asignación de recursos; no es un pronóstico de riqueza.",
      de: "Bezeichnet einen strukturellen Bereich für Ressourcenzufluss, -abfluss und Allokationsrhythmus; keine Vermögensprognose.",
      fr: "Désigne un domaine structurel du rythme d'entrée, de sortie et d'allocation des ressources ; ce n'est pas une prévision de richesse.",
    },
  },
  {
    traditional: "疾厄",
    slug: "zw_resilience_field",
    term: {
      zh: "承压调适域",
      en: "Resilience Field",
      es: "Campo de resiliencia",
      de: "Resilienzfeld",
      fr: "Champ de résilience",
    },
    definition: {
      zh: "标记承压、修复与身体边界相关的结构领域，不构成医学诊断。",
      en: "Names a structural domain for load-bearing, recovery, and bodily boundaries; it is not a medical diagnosis.",
      es: "Nombra un ámbito estructural de carga, recuperación y límites corporales; no constituye diagnóstico médico.",
      de: "Bezeichnet einen strukturellen Bereich für Belastung, Erholung und Körpergrenzen; keine medizinische Diagnose.",
      fr: "Désigne un domaine structurel de charge, de récupération et de limites corporelles ; ce n'est pas un diagnostic médical.",
    },
  },
  {
    traditional: "迁移",
    slug: "zw_mobility_field",
    term: {
      zh: "流动切换域",
      en: "Mobility Field",
      es: "Campo de movilidad",
      de: "Mobilitätsfeld",
      fr: "Champ de mobilité",
    },
    definition: {
      zh: "标记流动、迁徙与外部场域切换的结构领域，不预言迁居事件。",
      en: "Names a structural domain for movement, relocation themes, and external-field shifts; it does not predict moves.",
      es: "Nombra un ámbito estructural de movimiento, migración y cambio de campo externo; no predice mudanzas.",
      de: "Bezeichnet einen strukturellen Bereich für Bewegung, Ortswechsel und externe Feldwechsel; sagt keine Umzüge voraus.",
      fr: "Désigne un domaine structurel de mouvement, de migration et de changement de champ externe ; il ne prédit pas de déménagements.",
    },
  },
  {
    traditional: "仆役",
    slug: "zw_collab_network_field",
    term: {
      zh: "协作网络域",
      en: "Collab Network Field",
      es: "Campo de red colaborativa",
      de: "Kollaborationsnetzfeld",
      fr: "Champ de réseau collaboratif",
    },
    definition: {
      zh: "标记协作网络与支持链条的结构领域（引擎名「仆役」）；不贬低具体职位。",
      en: "Names a structural domain for collaboration networks and support chains (engine token 仆役); it does not demean roles.",
      es: "Nombra un ámbito estructural de redes de colaboración y cadenas de apoyo (token motor 仆役); no menosprecia roles.",
      de: "Bezeichnet einen strukturellen Bereich für Kollaborationsnetze und Stützketten (Engine-Token 仆役); wertet Rollen nicht ab.",
      fr: "Désigne un domaine structurel de réseaux de collaboration et de chaînes de soutien (jeton moteur 仆役) ; il ne dévalorise pas les rôles.",
    },
  },
  {
    traditional: "官禄",
    slug: "zw_role_craft_field",
    term: {
      zh: "职分事功域",
      en: "Role Craft Field",
      es: "Campo de oficio y rol",
      de: "Rollen-Handwerksfeld",
      fr: "Champ de métier et de rôle",
    },
    definition: {
      zh: "标记职分、事功与公开角色的结构领域，不是升职保证。",
      en: "Names a structural domain for role, craft, and public vocation; it is not a promotion guarantee.",
      es: "Nombra un ámbito estructural de rol, oficio y vocación pública; no garantiza ascensos.",
      de: "Bezeichnet einen strukturellen Bereich für Rolle, Handwerk und öffentliche Berufung; keine Beförderungszusage.",
      fr: "Désigne un domaine structurel de rôle, de métier et de vocation publique ; ce n'est pas une garantie de promotion.",
    },
  },
  {
    traditional: "田宅",
    slug: "zw_anchorage_field",
    term: {
      zh: "安顿根基域",
      en: "Anchorage Field",
      es: "Campo de anclaje",
      de: "Verankerungsfeld",
      fr: "Champ d'ancrage",
    },
    definition: {
      zh: "标记安顿、居所与根基感相关的结构领域，不预测房产买卖。",
      en: "Names a structural domain for settling, dwelling, and rootedness; it does not predict real-estate deals.",
      es: "Nombra un ámbito estructural de asentamiento, vivienda y arraigo; no predice compraventas inmobiliarias.",
      de: "Bezeichnet einen strukturellen Bereich für Sesshaftigkeit, Wohnen und Verwurzelung; sagt keine Immobiliengeschäfte voraus.",
      fr: "Désigne un domaine structurel d'installation, d'habitation et d'enracinement ; il ne prédit pas de transactions immobilières.",
    },
  },
  {
    traditional: "福德",
    slug: "zw_inner_reserve_field",
    term: {
      zh: "内在蓄养域",
      en: "Inner Reserve Field",
      es: "Campo de reserva interior",
      de: "Innere-Reserve-Feld",
      fr: "Champ de réserve intérieure",
    },
    definition: {
      zh: "标记内在蓄养与心理资源节奏的结构领域，不是福祸判决。",
      en: "Names a structural domain for inner reserve and psychological-resource rhythm; it is not a fortune verdict.",
      es: "Nombra un ámbito estructural de reserva interior y ritmo de recursos psicológicos; no es un veredicto de fortuna.",
      de: "Bezeichnet einen strukturellen Bereich für innere Reserve und psychologischen Ressourcenrhythmus; kein Glücks-/Unglücksurteil.",
      fr: "Désigne un domaine structurel de réserve intérieure et de rythme des ressources psychologiques ; ce n'est pas un verdict de fortune.",
    },
  },
  {
    traditional: "父母",
    slug: "zw_origin_support_field",
    term: {
      zh: "来源支撑域",
      en: "Origin Support Field",
      es: "Campo de soporte de origen",
      de: "Herkunfts-Stützfeld",
      fr: "Champ de soutien d'origine",
    },
    definition: {
      zh: "标记来源、长辈支撑与早期条件相关的结构领域，不定论家庭命运。",
      en: "Names a structural domain for origin, elder support, and early conditions; it does not judge family fate.",
      es: "Nombra un ámbito estructural de origen, apoyo de mayores y condiciones tempranas; no juzga el destino familiar.",
      de: "Bezeichnet einen strukturellen Bereich für Herkunft, Unterstützung durch Ältere und frühe Bedingungen; urteilt nicht über Familienschicksal.",
      fr: "Désigne un domaine structurel d'origine, de soutien aîné et de conditions précoces ; il ne juge pas le destin familial.",
    },
  },
  {
    traditional: "水二局",
    slug: "zw_config_water_dual",
    term: {
      zh: "水二配置",
      en: "Water Dual Config",
      es: "Configuración agua dual",
      de: "Wasser-Dual-Konfig",
      fr: "Config eau duale",
    },
    definition: {
      zh: "排盘所用的水元素二阶配置代号，不是实测物质属性。",
      en: "A water dual-order chart configuration code used in Ziwei casting; not a measured physical property.",
      es: "Código de configuración dual de agua usado en el esquema Ziwei; no es una propiedad física medida.",
      de: "Ein Wasser-Dual-Ordnungskonfigurationscode der Ziwei-Berechnung; keine gemessene physikalische Eigenschaft.",
      fr: "Code de configuration duale eau utilisé dans le thème Ziwei ; ce n'est pas une propriété physique mesurée.",
    },
  },
  {
    traditional: "木三局",
    slug: "zw_config_wood_triple",
    term: {
      zh: "木三配置",
      en: "Wood Triple Config",
      es: "Configuración madera triple",
      de: "Holz-Tripel-Konfig",
      fr: "Config bois triple",
    },
    definition: {
      zh: "排盘所用的木元素三阶配置代号，不是实测物质属性。",
      en: "A wood triple-order chart configuration code used in Ziwei casting; not a measured physical property.",
      es: "Código de configuración triple de madera usado en el esquema Ziwei; no es una propiedad física medida.",
      de: "Ein Holz-Tripel-Ordnungskonfigurationscode der Ziwei-Berechnung; keine gemessene physikalische Eigenschaft.",
      fr: "Code de configuration triple bois utilisé dans le thème Ziwei ; ce n'est pas une propriété physique mesurée.",
    },
  },
  {
    traditional: "金四局",
    slug: "zw_config_metal_quad",
    term: {
      zh: "金四配置",
      en: "Metal Quad Config",
      es: "Configuración metal cuádruple",
      de: "Metall-Quad-Konfig",
      fr: "Config métal quad",
    },
    definition: {
      zh: "排盘所用的金元素四阶配置代号，不是实测物质属性。",
      en: "A metal quad-order chart configuration code used in Ziwei casting; not a measured physical property.",
      es: "Código de configuración cuádruple de metal usado en el esquema Ziwei; no es una propiedad física medida.",
      de: "Ein Metall-Quad-Ordnungskonfigurationscode der Ziwei-Berechnung; keine gemessene physikalische Eigenschaft.",
      fr: "Code de configuration quadruple métal utilisé dans le thème Ziwei ; ce n'est pas une propriété physique mesurée.",
    },
  },
  {
    traditional: "土五局",
    slug: "zw_config_earth_penta",
    term: {
      zh: "土五配置",
      en: "Earth Penta Config",
      es: "Configuración tierra penta",
      de: "Erde-Penta-Konfig",
      fr: "Config terre penta",
    },
    definition: {
      zh: "排盘所用的土元素五阶配置代号，不是实测物质属性。",
      en: "An earth penta-order chart configuration code used in Ziwei casting; not a measured physical property.",
      es: "Código de configuración penta de tierra usado en el esquema Ziwei; no es una propiedad física medida.",
      de: "Ein Erde-Penta-Ordnungskonfigurationscode der Ziwei-Berechnung; keine gemessene physikalische Eigenschaft.",
      fr: "Code de configuration penta terre utilisé dans le thème Ziwei ; ce n'est pas une propriété physique mesurée.",
    },
  },
  {
    traditional: "火六局",
    slug: "zw_config_fire_hexa",
    term: {
      zh: "火六配置",
      en: "Fire Hexa Config",
      es: "Configuración fuego hexa",
      de: "Feuer-Hexa-Konfig",
      fr: "Config feu hexa",
    },
    definition: {
      zh: "排盘所用的火元素六阶配置代号，不是实测物质属性。",
      en: "A fire hexa-order chart configuration code used in Ziwei casting; not a measured physical property.",
      es: "Código de configuración hexa de fuego usado en el esquema Ziwei; no es una propiedad física medida.",
      de: "Ein Feuer-Hexa-Ordnungskonfigurationscode der Ziwei-Berechnung; keine gemessene physikalische Eigenschaft.",
      fr: "Code de configuration hexa feu utilisé dans le thème Ziwei ; ce n'est pas une propriété physique mesurée.",
    },
  },
];

const starRows = [
  ["紫微", "zw_star_apex_axis", "枢轴星轨", "Apex Axis Track", "Vía del eje apex", "Apex-Achsenspur", "Voie d'axe sommet", "标记结构图谱中的中枢参照星轨，不代表权力地位预测。"],
  ["天机", "zw_star_pattern_sense", "机微星轨", "Pattern Sense Track", "Vía de sentido de patrones", "Muster-Sinn-Spur", "Voie de sens des motifs", "标记偏好梳理节律与机微的结构星轨，不是智商测量。"],
  ["太阳", "zw_star_radiant_out", "外放星轨", "Radiant Out Track", "Vía de irradiación", "Strahl-Aus-Spur", "Voie de rayonnement", "标记外向呈现与可见输出相关的结构星轨。"],
  ["武曲", "zw_star_craft_edge", "利器星轨", "Craft Edge Track", "Vía del filo del oficio", "Handwerks-Kantenspur", "Voie du tranchant métier", "标记锋利事功与工具感相关的结构星轨。"],
  ["天同", "zw_star_ease_bond", "舒契星轨", "Ease Bond Track", "Vía del vínculo suave", "Leichte-Bindungs-Spur", "Voie du lien doux", "标记舒缓联结与协调偏好的结构星轨。"],
  ["廉贞", "zw_star_intense_edge", "烈度星轨", "Intense Edge Track", "Vía de intensidad", "Intens-Kantenspur", "Voie d'intensité", "标记烈度、界限与张力相关的结构星轨。"],
  ["天府", "zw_star_storehouse", "府库星轨", "Storehouse Track", "Vía de reserva", "Speicher-Spur", "Voie de réserve", "标记蓄积与府库感相关的结构星轨。"],
  ["太阴", "zw_star_inward_tide", "内潮星轨", "Inward Tide Track", "Vía de marea interior", "Innen-Gezeiten-Spur", "Voie de marée intérieure", "标记内向潮汐与含藏节奏相关的结构星轨。"],
  ["贪狼", "zw_star_desire_drive", "欲求星轨", "Desire Drive Track", "Vía del deseo", "Begehren-Antriebs-Spur", "Voie du désir", "标记欲求驱动与探索张力相关的结构星轨，不是道德评判。"],
  ["巨门", "zw_star_voice_gate", "言门星轨", "Voice Gate Track", "Vía de la puerta de la voz", "Stimm-Tor-Spur", "Voie de la porte de la voix", "标记言说、辨析与信息门径相关的结构星轨。"],
  ["天相", "zw_star_protocol", "仪轨星轨", "Protocol Track", "Vía de protocolo", "Protokoll-Spur", "Voie de protocole", "标记程序、仪轨与中介角色相关的结构星轨。"],
  ["天梁", "zw_star_elder_shade", "荫护星轨", "Elder Shade Track", "Vía de amparo", "Schutzschatten-Spur", "Voie d'ombre tutelle", "标记荫护、劝诫与承托相关的结构星轨。"],
  ["七杀", "zw_star_breach_force", "破局星轨", "Breach Force Track", "Vía de ruptura", "Durchbruch-Kraft-Spur", "Voie de force de rupture", "标记破局力与锋面推进相关的结构星轨；须与八字「七杀」十神分 namespace。"],
  ["破军", "zw_star_reset_edge", "重整星轨", "Reset Edge Track", "Vía de reinicio", "Neuordnungs-Spur", "Voie de réinit", "标记拆解重整与边界改写相关的结构星轨。"],
  ["文昌", "zw_star_script_clarity", "文晰星轨", "Script Clarity Track", "Vía de claridad textual", "Schrift-Klar-Spur", "Voie de clarté écrite", "标记表达清晰与文书取向相关的结构星轨；与神煞「文昌」分 namespace。"],
  ["文曲", "zw_star_lyric_flow", "文韵星轨", "Lyric Flow Track", "Vía de flujo lírico", "Lyrik-Fluss-Spur", "Voie de flux lyrique", "标记韵律、审美表达相关的结构星轨。"],
  ["左辅", "zw_star_left_support", "左辅星轨", "Left Support Track", "Vía de apoyo izquierdo", "Linke-Stütz-Spur", "Voie de soutien gauche", "标记侧翼支持与成全相关的结构星轨。"],
  ["右弼", "zw_star_right_support", "右弼星轨", "Right Support Track", "Vía de apoyo derecho", "Rechte-Stütz-Spur", "Voie de soutien droit", "标记另一侧翼支持与成全相关的结构星轨。"],
  ["禄存", "zw_star_resource_cache", "禄存星轨", "Resource Cache Track", "Vía de caché de recursos", "Ressourcen-Cache-Spur", "Voie de cache ressources", "标记资源留存节点相关的结构星轨，不是收入预测。"],
  ["火星", "zw_star_ignition", "燃点星轨", "Ignition Track", "Vía de ignición", "Zünd-Spur", "Voie d'allumage", "标记点燃、加速与躁动张力相关的结构星轨。"],
];

for (const [traditional, slug, zh, en, es, de, fr, dzh] of starRows) {
  entries.push({
    traditional,
    slug,
    term: { zh, en, es, de, fr },
    definition: {
      zh: dzh,
      en: "A structural star track in the Ziwei index; it is not a personality verdict or event prediction.",
      es: "Una vía estelar estructural en el índice Ziwei; no es un veredicto de personalidad ni una predicción de hechos.",
      de: "Eine strukturelle Sternspur im Ziwei-Index; kein Persönlichkeitsurteil und keine Ereignisprognose.",
      fr: "Une voie stellaire structurelle dans l'index Ziwei ; ce n'est pas un verdict de personnalité ni une prédiction d'événements.",
    },
  });
}

function q(s) {
  return JSON.stringify(s);
}

function emit(e) {
  return `  {
    ns: "ziwei",
    slug: ${q(e.slug)},
    traditional: ${q(e.traditional)},
    polarity: "neutral",
    term: {
      zh: ${q(e.term.zh)},
      en: ${q(e.term.en)},
      es: ${q(e.term.es)},
      de: ${q(e.term.de)},
      fr: ${q(e.term.fr)},
    },
    definition: {
      zh: ${q(e.definition.zh)},
      en: ${q(e.definition.en)},
      es: ${q(e.definition.es)},
      de: ${q(e.definition.de)},
      fr: ${q(e.definition.fr)},
    },
  },`;
}

if (entries.length !== 36) {
  console.error("expected 36 entries, got", entries.length);
  process.exit(1);
}

const block = [
  "  // --- ziwei Phase 11 public values (palaces / five-elements configs / major+aux stars). ---",
  ...entries.map(emit),
].join("\n");

const out = join(process.cwd(), "tmp-phase11-terms-fragment.ts");
writeFileSync(out, block + "\n", "utf8");
console.log("wrote", out, "entries=", entries.length);
