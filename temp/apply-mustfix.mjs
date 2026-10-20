#!/usr/bin/env node
/**
 * Eastern OS Must-fix 1–10 copy audit — apply against repo root (cwd).
 * Run: node apply-mustfix.mjs
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const report = [];
function log(msg) { report.push(msg); console.log(msg); }
function read(p) { return fs.readFileSync(path.join(root, p), "utf8"); }
function write(p, s) { fs.writeFileSync(path.join(root, p), s, "utf8"); log("wrote " + p); }
function readJson(p) { return JSON.parse(read(p)); }
function writeJson(p, o) { write(p, JSON.stringify(o, null, 2) + "\n"); }

// ─── 1+2+8 FAQ ───────────────────────────────────────────────
{
  let faq = read("public/v2/faq-i18n.js");

  const q3 = {
    zh: "封面与目录之后：<strong>六页</strong>正文（另有附录）。<br><strong>P1 · 核心直答</strong> — 主路径 + 备用，以及更建议哪条。<br><strong>P2 · 归因剖析</strong> — 你为什么卡住。<br><strong>P3 · 破局策略</strong> — 主轨（及较简辅轨）上可执行的做法。<br><strong>P4 · 东方谋略</strong> — 同一案的东方看法与调法。<br><strong>P5 · 风险预警</strong> — 红灯，以及何时切辅。<br><strong>P6 · 今晚与收尾</strong> — 今晚、近阶清单、观察信号。<br>关键句可展开 <strong>依据与推理</strong>。报告在<strong>当前浏览器本地</strong>；要带走请导出或邮件发出。",
    en: "After cover and contents: <strong>six pages</strong> (plus an appendix).<br><strong>P1 · Core Answer</strong> — main path + backup, and which to prefer.<br><strong>P2 · Root Analysis</strong> — why you’re stuck.<br><strong>P3 · Breakthrough Strategy</strong> — practical moves on the main (and simpler backup) track.<br><strong>P4 · Eastern Stratagem</strong> — Eastern read of the same case.<br><strong>P5 · Risk Guard</strong> — red lights and when to switch tracks.<br><strong>P6 · Tonight & Close</strong> — tonight, near-term checklist, watch signals.<br>Key lines can open <strong>Evidence & reasoning</strong>. Lives in <strong>this browser</strong>; export or email to take it with you.",
    es: "Tras portada e índice: <strong>seis páginas</strong> (más un apéndice).<br><strong>P1 · Respuesta central</strong> — ruta principal + respaldo, y cuál preferir.<br><strong>P2 · Análisis de raíz</strong> — por qué estás atascado.<br><strong>P3 · Estrategia de avance</strong> — movimientos prácticos en la vía principal (y respaldo más simple).<br><strong>P4 · Estrategia oriental</strong> — lectura oriental del mismo caso.<br><strong>P5 · Alerta de riesgo</strong> — luces rojas y cuándo cambiar de vía.<br><strong>P6 · Esta noche y cierre</strong> — esta noche, checklist a corto plazo, señales a vigilar.<br>Líneas clave pueden abrir <strong>Evidencia y razonamiento</strong>. Vive en <strong>este navegador</strong>; exporta o envía por correo para llevártelo.",
    fr: "Après couverture et sommaire : <strong>six pages</strong> (plus une annexe).<br><strong>P1 · Réponse centrale</strong> — voie principale + secours, et laquelle préférer.<br><strong>P2 · Analyse des causes</strong> — pourquoi tu es bloqué.<br><strong>P3 · Stratégie de percée</strong> — gestes pratiques sur la voie principale (et secours plus simple).<br><strong>P4 · Stratagème oriental</strong> — lecture orientale du même cas.<br><strong>P5 · Garde des risques</strong> — feux rouges et quand changer de voie.<br><strong>P6 · Ce soir et clôture</strong> — ce soir, checklist court terme, signaux à surveiller.<br>Des lignes clés peuvent ouvrir <strong>Preuves et raisonnement</strong>. Vit dans <strong>ce navigateur</strong> ; exporte ou e-mail pour l’emporter.",
  };

  const q10 = {
    zh: "<strong>购买 Pass $19.99</strong> = 1 PASS，一次性、不自动续费、用完为止；<strong>未使用的已购买 Pass 可在 PASS 详情申请退款</strong>（到账时间按支付渠道规则）。<br><strong>订阅包 $59.99 / 月</strong> = <strong>每月发放 5 PASS</strong>；<strong>新用户仅首月 +2</strong>（该月共 7）。<br>消耗顺序：先用<strong>结转额度</strong>，再<strong>订阅额度</strong>，最后<strong>买断 PASS</strong>。",
    en: "<strong>Buy Pass $19.99</strong> = 1 PASS, one-time, no auto-renew, valid until used; <strong>unused purchased Passes can be refunded in PASS details</strong> (timing follows your payment provider).<br><strong>Subscription $59.99 / mo</strong> = <strong>5 PASS granted every month</strong>; <strong>new subscribers get +2 in the first month only</strong> (7 that month).<br>Spend order: any <strong>carryover</strong> first, then <strong>subscription</strong> credits, then <strong>purchased</strong> PASS.",
    es: "<strong>Comprar Pass $19.99</strong> = 1 PASS, una sola vez, sin auto-renovación, válido hasta usarlo; <strong>los Pass comprados sin usar se pueden reembolsar en detalles de PASS</strong> (los plazos siguen a tu proveedor de pago).<br><strong>Suscripción $59.99 / mes</strong> = <strong>5 PASS otorgados cada mes</strong>; <strong>nuevos suscriptores reciben +2 solo el primer mes</strong> (7 ese mes).<br>Orden de consumo: primero cualquier <strong>arrastre</strong>, luego créditos de <strong>suscripción</strong>, luego PASS <strong>comprados</strong>.",
    fr: "<strong>Acheter un Pass $19.99</strong> = 1 PASS, une fois, sans renouvellement auto, valable jusqu’à utilisation ; <strong>les Pass achetés non utilisés peuvent être remboursés dans les détails PASS</strong> (délais selon ton prestataire de paiement).<br><strong>Abonnement $59.99 / mois</strong> = <strong>5 PASS accordés chaque mois</strong> ; <strong>nouveaux abonnés : +2 le premier mois seulement</strong> (7 ce mois-là).<br>Ordre de consommation : d’abord tout <strong>report</strong>, puis crédits d’<strong>abonnement</strong>, puis PASS <strong>achetés</strong>.",
  };

  // Replace q3/q10 answers by locating id blocks within each locale section roughly
  function replaceFaqAnswer(src, locale, qid, newAnswer) {
    // Find locale block start
    const locRe = new RegExp(`\\b${locale}\\s*:\\s*\\{`);
    const locMatch = locRe.exec(src);
    if (!locMatch) throw new Error("locale not found: " + locale);
    const start = locMatch.index;
    // End at next top-level locale or closing of V2_FAQ_I18N — heuristic: next "\\n  xx: {" at same indent
    const nextLoc = src.slice(start + 1).search(/\n  (zh|en|es|fr)\s*:\s*\{/);
    const end = nextLoc === -1 ? src.length : start + 1 + nextLoc;
    let block = src.slice(start, end);
    const idRe = new RegExp(`("id"\\s*:\\s*"${qid}"\\s*,\\s*"question"\\s*:\\s*"[^"]*"\\s*,\\s*"answer"\\s*:\\s*")([\\s\\S]*?)(")`);
    // answers may contain escaped quotes — use non-greedy until '",\n or '"\n
    const idIdx = block.indexOf(`"id": "${qid}"`);
    if (idIdx < 0) throw new Error(`qid ${qid} not in ${locale}`);
    const ansKey = '"answer": "';
    const ansIdx = block.indexOf(ansKey, idIdx);
    if (ansIdx < 0) throw new Error(`answer not found for ${locale} ${qid}`);
    const valStart = ansIdx + ansKey.length;
    // scan for unescaped closing quote
    let i = valStart;
    while (i < block.length) {
      if (block[i] === "\\" ) { i += 2; continue; }
      if (block[i] === '"') break;
      i++;
    }
    const oldAns = block.slice(valStart, i);
    // escape new answer for JSON string context inside JS
    const escaped = newAnswer.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    block = block.slice(0, valStart) + escaped + block.slice(i);
    return src.slice(0, start) + block + src.slice(end);
  }

  for (const loc of ["zh", "en", "es", "fr"]) {
    faq = replaceFaqAnswer(faq, loc, "q3", q3[loc]);
    faq = replaceFaqAnswer(faq, loc, "q10", q10[loc]);
  }

  // ZH q9 购票 → 购买
  faq = faq.replace("购票/账单收据邮件是聊天备份吗？", "购买/账单收据邮件是聊天备份吗？");

  // Sanity: no Chinese paren leftovers in en/es/fr q3
  if (/Core Answer（|Root Analysis（|Breakthrough Strategy（|Eastern Stratagem（|Risk Guard（|Tonight & Close（|Evidence & reasoning（/.test(faq)) {
    throw new Error("bilingual Chinese parens still present in FAQ");
  }
  if (faq.includes("出门仪式")) throw new Error("出门仪式 still present");
  if (faq.includes("购票/")) throw new Error("购票 still present");
  if (faq.includes("one-click refund anytime")) throw new Error("one-click refund anytime still in FAQ");

  write("public/v2/faq-i18n.js", faq);
  log("MF1+2+8 FAQ done");
}

// ─── helpers for JSON deep set ───────────────────────────────
function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
function delPath(obj, dotted) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) return;
    cur = cur[parts[i]];
  }
  delete cur[parts[parts.length - 1]];
}

// ─── 5+6+7 messages JSON ─────────────────────────────────────
{
  const birth = {
    en: {
      "birthForm.subtitle": "We use this once to structure your decision dialogue.",
      "birthForm.title": "Birth information",
      "profile.birth_location.explanation_1": "Birth place helps Eastern OS structure this decision session from your coordinates—not a fortune-telling chart.",
      "profile.birth_location.explanation_2": "Location anchors the session structure for *this* dialogue.",
      "profile.birth_location.explanation_example": "Example: the same clock time in different cities can mean a different local context—confirm the city where you were born.",
      "profile.birth_location.location_required_note": "Confirm your birth city or search for another. Needed to structure this session.",
      "profile.birth_location.subtitle": "Birth date, time, and place — required to structure this session—not fortune-telling.",
      "profile.upgrade.description": "This session was started without a birth city. Add it so the dialogue structure matches where you were born.",
      "profile.upgrade.upgrade_success": "Birth place saved for this session structure.",
      "profile.upgrade.tst_diff_minutes": "Location adjustment applied: {minutes} minutes",
      "profile.upgrade.title": "Add birth city for this session",
      "profile.upgrade.using_default_warning": "Started without a birth city — add it to match your birth place",
      "profile.upgrade.upgrade_chart": "Save birth city for this session",
      "profile.upgrade.keep_old_for_now": "Keep current session for now",
      "profile.upgrade.badge_precise": "✓ Birth place set",
      "profile.upgrade.badge_upgradeable": "Add birth city",
      "profile.upgrade.hour_pillar_changed": "Session structure updated",
      "profile.upgrade.hour_pillar_unchanged": "Session structure unchanged",
      "profile.upgrade.base_analysis_regenerated": "Session structure refreshed with the birth place.",
      "birth_form.why_explanation": "Birth place helps Eastern OS structure this decision session from your coordinates—not a fortune-telling chart.",
      "birth_form.true_solar_offset": "Location adjustment: {offset}",
      "birthForm.skipConfirmBody": "Without birth data we use a generic session structure only. You can add this anytime in profile settings.",
      "birthForm.submit": "Save birth information",
      "birthForm.done": "Birth information saved.",
      "birthForm.submitting": "Saving…",
    },
    zh: {
      "birthForm.subtitle": "仅用于结构化本次决策对话。",
      "birthForm.title": "出生信息",
      "profile.birth_location.explanation_1": "出生地用于按你的坐标结构化本次决策会话——不是算命盘。",
      "profile.birth_location.explanation_2": "地点锚定的是**这场**对话的会话结构。",
      "profile.birth_location.explanation_example": "例如：同一钟表时间在不同城市对应不同本地语境——请确认你真实的出生城市。",
      "profile.birth_location.location_required_note": "请确认出生城市，或搜索其他城市。用于结构化本次会话。",
      "profile.birth_location.subtitle": "出生日期、时间与地点——必填，用于结构化本次会话——不是算命。",
      "profile.upgrade.description": "本次会话未填写出生城市。补上后，对话结构会更贴合你的出生地。",
      "profile.upgrade.upgrade_success": "出生地已保存，用于本次会话结构。",
      "profile.upgrade.tst_diff_minutes": "已按出生地调整：{minutes} 分钟",
      "profile.upgrade.title": "补充出生城市以完善本次会话",
      "profile.upgrade.using_default_warning": "未填写出生城市 — 补上后更贴合你的出生地",
      "profile.upgrade.upgrade_chart": "保存出生城市用于本次会话",
      "profile.upgrade.keep_old_for_now": "暂时保持当前会话",
      "profile.upgrade.badge_precise": "✓ 已设出生地",
      "profile.upgrade.badge_upgradeable": "补充出生城市",
      "profile.upgrade.hour_pillar_changed": "会话结构已更新",
      "profile.upgrade.hour_pillar_unchanged": "会话结构未变",
      "profile.upgrade.base_analysis_regenerated": "已按出生地刷新会话结构。",
      "birth_form.why_explanation": "出生地用于按你的坐标结构化本次决策会话——不是算命盘。",
      "birth_form.true_solar_offset": "按出生地调整：{offset}",
      "birthForm.skipConfirmBody": "不填出生信息时仅用通用会话结构。可随时在个人资料中补上。",
      "birthForm.submit": "保存出生信息",
      "birthForm.done": "出生信息已保存。",
      "birthForm.submitting": "保存中…",
    },
    es: {
      "birthForm.subtitle": "Se usa una vez para estructurar tu diálogo de decisión.",
      "birthForm.title": "Datos de nacimiento",
      "profile.birth_location.explanation_1": "El lugar de nacimiento ayuda a Eastern OS a estructurar esta sesión de decisión con tus coordenadas—no es una carta de adivinación.",
      "profile.birth_location.explanation_2": "La ubicación ancla la estructura de *este* diálogo.",
      "profile.birth_location.explanation_example": "Ejemplo: la misma hora de reloj en ciudades distintas puede cambiar el contexto local—confirma la ciudad donde naciste.",
      "profile.birth_location.location_required_note": "Confirma tu ciudad de nacimiento o busca otra. Hace falta para estructurar esta sesión.",
      "profile.birth_location.subtitle": "Fecha, hora y lugar de nacimiento — obligatorios para estructurar esta sesión—no es adivinación.",
      "profile.upgrade.description": "Esta sesión empezó sin ciudad de nacimiento. Añádela para que la estructura del diálogo coincida con dónde naciste.",
      "profile.upgrade.upgrade_success": "Lugar de nacimiento guardado para la estructura de esta sesión.",
      "profile.upgrade.tst_diff_minutes": "Ajuste por ubicación: {minutes} minutos",
      "profile.upgrade.title": "Añade ciudad de nacimiento para esta sesión",
      "profile.upgrade.using_default_warning": "Empezó sin ciudad de nacimiento — añádela para alinearla con tu lugar de nacimiento",
      "profile.upgrade.upgrade_chart": "Guardar ciudad de nacimiento para esta sesión",
      "profile.upgrade.keep_old_for_now": "Mantener la sesión actual por ahora",
      "profile.upgrade.badge_precise": "✓ Lugar de nacimiento listo",
      "profile.upgrade.badge_upgradeable": "Añadir ciudad de nacimiento",
      "profile.upgrade.hour_pillar_changed": "Estructura de sesión actualizada",
      "profile.upgrade.hour_pillar_unchanged": "Estructura de sesión sin cambios",
      "profile.upgrade.base_analysis_regenerated": "Estructura de sesión actualizada con el lugar de nacimiento.",
      "birth_form.why_explanation": "El lugar de nacimiento ayuda a Eastern OS a estructurar esta sesión de decisión con tus coordenadas—no es una carta de adivinación.",
      "birth_form.true_solar_offset": "Ajuste por ubicación: {offset}",
      "birthForm.skipConfirmBody": "Sin datos de nacimiento usamos solo una estructura genérica de sesión. Puedes añadirlos en el perfil cuando quieras.",
      "birthForm.submit": "Guardar datos de nacimiento",
      "birthForm.done": "Datos de nacimiento guardados.",
      "birthForm.submitting": "Guardando…",
    },
    fr: {
      "birthForm.subtitle": "Utilisé une seule fois pour structurer ton dialogue de décision.",
      "birthForm.title": "Informations de naissance",
      "profile.birth_location.explanation_1": "Le lieu de naissance aide Eastern OS à structurer cette session de décision avec tes coordonnées—pas un thème divinatoire.",
      "profile.birth_location.explanation_2": "Le lieu ancre la structure de *ce* dialogue.",
      "profile.birth_location.explanation_example": "Exemple : la même heure d’horloge dans des villes différentes peut changer le contexte local—confirme la ville où tu es né·e.",
      "profile.birth_location.location_required_note": "Confirme ta ville de naissance ou cherche-en une autre. Nécessaire pour structurer cette session.",
      "profile.birth_location.subtitle": "Date, heure et lieu de naissance — obligatoires pour structurer cette session—pas de voyance.",
      "profile.upgrade.description": "Cette session a commencé sans ville de naissance. Ajoute-la pour que la structure du dialogue corresponde à ton lieu de naissance.",
      "profile.upgrade.upgrade_success": "Lieu de naissance enregistré pour la structure de cette session.",
      "profile.upgrade.tst_diff_minutes": "Ajustement selon le lieu : {minutes} minutes",
      "profile.upgrade.title": "Ajouter la ville de naissance pour cette session",
      "profile.upgrade.using_default_warning": "Sans ville de naissance — ajoute-la pour coller à ton lieu de naissance",
      "profile.upgrade.upgrade_chart": "Enregistrer la ville de naissance pour cette session",
      "profile.upgrade.keep_old_for_now": "Garder la session actuelle pour l’instant",
      "profile.upgrade.badge_precise": "✓ Lieu de naissance défini",
      "profile.upgrade.badge_upgradeable": "Ajouter la ville de naissance",
      "profile.upgrade.hour_pillar_changed": "Structure de session mise à jour",
      "profile.upgrade.hour_pillar_unchanged": "Structure de session inchangée",
      "profile.upgrade.base_analysis_regenerated": "Structure de session rafraîchie avec le lieu de naissance.",
      "birth_form.why_explanation": "Le lieu de naissance aide Eastern OS à structurer cette session de décision avec tes coordonnées—pas un thème divinatoire.",
      "birth_form.true_solar_offset": "Ajustement selon le lieu : {offset}",
      "birthForm.skipConfirmBody": "Sans données de naissance, on utilise seulement une structure de session générique. Tu peux les ajouter plus tard dans le profil.",
      "birthForm.submit": "Enregistrer les informations de naissance",
      "birthForm.done": "Informations de naissance enregistrées.",
      "birthForm.submitting": "Enregistrement…",
    },
  };

  const passRow = {
    en: {
      "workspace.passRow.balance": "PASS·{n}",
      "workspace.passRow.balanceAria": "PASS balance: {n}",
      "workspace.passRow.buy": "Buy",
      "workspace.passRow.buyAria": "Buy PASS",
      "workspace.passRow.buyTitle": "Buy PASS",
      "workspace.passRow.buyShort": "+",
    },
    zh: {
      "workspace.passRow.balance": "PASS·{n}",
      "workspace.passRow.balanceAria": "PASS 余额：{n}",
      "workspace.passRow.buy": "购买",
      "workspace.passRow.buyAria": "购买 PASS",
      "workspace.passRow.buyTitle": "购买 PASS",
      "workspace.passRow.buyShort": "+",
    },
    es: {
      "workspace.passRow.balance": "PASS·{n}",
      "workspace.passRow.balanceAria": "Saldo PASS: {n}",
      "workspace.passRow.buy": "Comprar",
      "workspace.passRow.buyAria": "Comprar PASS",
      "workspace.passRow.buyTitle": "Comprar PASS",
      "workspace.passRow.buyShort": "+",
    },
    fr: {
      "workspace.passRow.balance": "PASS·{n}",
      "workspace.passRow.balanceAria": "Solde PASS : {n}",
      "workspace.passRow.buy": "Acheter",
      "workspace.passRow.buyAria": "Acheter un PASS",
      "workspace.passRow.buyTitle": "Acheter un PASS",
      "workspace.passRow.buyShort": "+",
    },
  };

  const account = {
    en: {
      "account.financialProtocols": "Billing & payments",
      "account.terminalActions": "Account actions",
      "account.accountErasure": "Delete account",
      "account.initiateErasure": "Delete account",
      "account.deleteHint": "Permanently deletes your account and server-side PASS ledger. This can’t be undone.",
      "account.planFlex": "Buy Pass",
      "passPurchase.flexTitle": "Buy Pass",
      "account.planPersonal": "Subscription",
      "account.passCardHint": "Valid until used · 1 PASS = one full dialogue run · unused Passes refundable per policy.",
      "account.passBalanceHint": "Passes you bought — valid until used; unused units refundable per policy. **1 PASS** runs one full decision dialogue.",
      "passPurchase.spendOrder": "Spend order: carryover → subscription → purchased Passes.",
      "account.subCardHint": "Subscription: **5 PASS / month**. Subscription credits use before purchased Passes.",
      "account.passBalance": "Purchased Pass",
    },
    zh: {
      "account.financialProtocols": "账单与支付",
      "account.terminalActions": "账户操作",
      "account.accountErasure": "删除账户",
      "account.initiateErasure": "删除账户",
      "account.deleteHint": "将永久删除你的账户及服务端 PASS 账本。此操作不可撤销。",
      "account.planFlex": "购买 Pass",
      "passPurchase.flexTitle": "购买 Pass",
      "account.planPersonal": "订阅",
      "account.passCardHint": "用完前有效 · 1 PASS = 一次完整决策对话 · 未使用可按政策退款。",
      "account.passBalanceHint": "你购买的 Pass — 用完前有效；未使用可按政策退款。**1 PASS** 开启一次完整决策对话。",
      "passPurchase.spendOrder": "消耗顺序：结转额度 → 订阅额度 → 已购买 Pass。",
      "account.subCardHint": "订阅：**每月 5 PASS**。订阅额度优先于已购 Pass 消耗。",
      "account.passBalance": "已购买 Pass",
    },
    es: {
      "account.financialProtocols": "Facturación y pagos",
      "account.terminalActions": "Acciones de la cuenta",
      "account.accountErasure": "Eliminar cuenta",
      "account.initiateErasure": "Eliminar cuenta",
      "account.deleteHint": "Elimina permanentemente tu cuenta y el libro de PASS en el servidor. No se puede deshacer.",
      "account.planFlex": "Comprar Pass",
      "passPurchase.flexTitle": "Comprar Pass",
      "account.planPersonal": "Suscripción",
      "account.passCardHint": "Válido hasta usarlo · 1 PASS = un diálogo completo · reembolsable si no se usó, según política.",
      "account.passBalanceHint": "Passes que compraste — válidos hasta usarse; sin usar, reembolsables según política. **1 PASS** = un diálogo de decisión completo.",
      "passPurchase.spendOrder": "Orden de consumo: arrastre → suscripción → Passes comprados.",
      "account.subCardHint": "Suscripción: **5 PASS / mes**. Los créditos de suscripción se usan antes que los comprados.",
      "account.passBalance": "Pass comprado",
    },
    fr: {
      "account.financialProtocols": "Facturation et paiements",
      "account.terminalActions": "Actions du compte",
      "account.accountErasure": "Supprimer le compte",
      "account.initiateErasure": "Supprimer le compte",
      "account.deleteHint": "Supprime définitivement ton compte et le grand livre PASS côté serveur. Irréversible.",
      "account.planFlex": "Acheter un Pass",
      "passPurchase.flexTitle": "Acheter un Pass",
      "account.planPersonal": "Abonnement",
      "account.passCardHint": "Valable jusqu’à utilisation · 1 PASS = un dialogue complet · remboursable si non utilisé, selon la politique.",
      "account.passBalanceHint": "Passes achetés — valables jusqu’à utilisation ; non utilisés, remboursables selon la politique. **1 PASS** = un dialogue de décision complet.",
      "passPurchase.spendOrder": "Ordre de consommation : report → abonnement → Passes achetés.",
      "account.subCardHint": "Abonnement : **5 PASS / mois**. Les crédits d’abonnement avant les Passes achetés.",
      "account.passBalance": "Pass acheté",
    },
  };

  // Hide energy chrome labels if present
  const hideBlurb = {
    en: { "workspace.blurb.atmos": "", "workspace.atmos.hero.heading": "" },
    zh: { "workspace.blurb.atmos": "", "workspace.atmos.hero.heading": "" },
    es: { "workspace.blurb.atmos": "", "workspace.atmos.hero.heading": "" },
    fr: { "workspace.blurb.atmos": "", "workspace.atmos.hero.heading": "" },
  };

  for (const loc of ["en", "zh", "es", "fr"]) {
    const p = `messages/${loc}.json`;
    const j = readJson(p);
    for (const pack of [birth[loc], passRow[loc], account[loc], hideBlurb[loc]]) {
      for (const [k, v] of Object.entries(pack)) setPath(j, k, v);
    }
    // Hide planTeam by emptying (UI may check presence) — set empty string; also flag
    setPath(j, "account.planTeam", "");
    // Strip true solar / natal / hour pillar from remaining user-facing birth strings if still present
    const dump = JSON.stringify(j);
    // Soft scrub remaining true-solar phrases in birth_location.why_link etc.
    if (j.profile?.birth_location?.why_link) {
      const wl = {
        en: "Why birth place matters?",
        zh: "为什么需要出生地？",
        es: "¿Por qué importa el lugar de nacimiento?",
        fr: "Pourquoi le lieu de naissance ?",
      };
      j.profile.birth_location.why_link = wl[loc];
    }
    if (j.profile?.birth_location?.title) {
      const t = { en: "Birth place?", zh: "出生地？", es: "¿Lugar de nacimiento?", fr: "Lieu de naissance ?" };
      j.profile.birth_location.title = t[loc];
    }
    if (j.poju_matrix?.card) {
      if (j.poju_matrix.card.true_solar_time != null) j.poju_matrix.card.true_solar_time = { en: "Session structure", zh: "会话结构", es: "Estructura de sesión", fr: "Structure de session" }[loc];
      if (j.poju_matrix.card.true_solar != null) j.poju_matrix.card.true_solar = { en: "Session", zh: "会话", es: "Sesión", fr: "Session" }[loc];
    }
    // FR privacy chat→conversation where product dialogue (messages locale may have chat keys — light scrub later in landing)
    writeJson(p, j);
  }
  log("MF5+6+7 messages JSON done");
}

// ─── 9 contact.json ──────────────────────────────────────────
{
  const contacts = {
    en: {
      meta: {
        title: "Contact — Eastern OS",
        description: "Questions about Eastern OS, PASS, or your account?",
        version: "Version 1.1",
        pageTitle: "Contact Eastern OS",
      },
      intro: {
        p1: "We read every message. Real people on the Eastern OS team reply as soon as we can.",
        p2: "Pick the topic below so we can route you faster.",
      },
      footer:
        "This page is localized for convenience. Support is strongest in English and Chinese—you’re welcome to write in your language; we use translation tools when needed.",
      billing: {
        title: "1. Billing, PASS & subscriptions",
        body: "For payment issues, PASS balance questions, Buy Pass, or Subscription:",
        emailLabel: "Email:",
        responseLabel: "Response:",
        response: "Usually within 24 hours on business days.",
        note: "For a refund request, include your payment Transaction ID from checkout.",
      },
      subscription: {
        title: "2. Cancel subscription (self-serve)",
        bodyBefore: "To stop Subscription auto-renew, you don’t need to email us. Use",
        manageLink: "Manage subscription",
        bodyAfter: "in your account.",
      },
      privacy: {
        title: "3. Privacy & data",
        body: "For privacy questions, local browser data, or requests about your account email on billing:",
        emailLabel: "Email:",
        responseLabel: "Response:",
        response: "Usually within 48 hours.",
      },
      legal: {
        title: "4. Legal",
        body: "For legal, copyright, or formal verification requests:",
        emailLabel: "Email:",
        responseLabel: "Response:",
        response: "Usually within 5 business days.",
      },
      beforeWrite: {
        title: "Before you write",
        body: "Many answers are already in:",
        terms: "Terms of Service (v1.2)",
        termsDesc: "Commercial engagement boundaries",
        privacy: "Privacy Policy (v1.1)",
        privacyDesc: "Local encryption & data protocols",
        disclaimer: "Disclaimer & Limitation of Liability (v1.1)",
        disclaimerDesc: "Scope of AI algorithmic reflections",
        refund: "Refund Policy (v1.1)",
        refundDesc: "Technical transaction reversal parameters",
      },
    },
    zh: {
      meta: {
        title: "联系我们 — Eastern OS",
        description: "关于 Eastern OS、PASS 或账户的问题？",
        version: "Version 1.1",
        pageTitle: "联系 Eastern OS",
      },
      intro: {
        p1: "我们会阅读每封来信。Eastern OS 团队由真人尽快回复。",
        p2: "请选择下方主题，方便我们更快转给对应同事。",
      },
      footer:
        "本页为方便阅读做了本地化。支持以英文、中文最稳——也可用你的语言写信；需要时我们会借助翻译工具。",
      billing: {
        title: "1. 账单、PASS 与订阅",
        body: "支付问题、PASS 余额、购买 Pass 或订阅相关：",
        emailLabel: "邮箱：",
        responseLabel: "回复：",
        response: "通常在工作日 24 小时内回复。",
        note: "申请退款请附上结账时的支付 Transaction ID。",
      },
      subscription: {
        title: "2. 取消订阅（自助）",
        bodyBefore: "要停止订阅自动续费，不必等邮件。请在账户里使用",
        manageLink: "管理订阅",
        bodyAfter: "。",
      },
      privacy: {
        title: "3. 隐私与数据",
        body: "隐私问题、浏览器本地数据，或账单相关邮箱请求：",
        emailLabel: "邮箱：",
        responseLabel: "回复：",
        response: "通常在 48 小时内回复。",
      },
      legal: {
        title: "4. 法律事务",
        body: "法律、版权或正式核验请求：",
        emailLabel: "邮箱：",
        responseLabel: "回复：",
        response: "通常在 5 个工作日内回复。",
      },
      beforeWrite: {
        title: "写信之前",
        body: "许多问题可在下列页面先找到答案：",
        terms: "服务条款 (v1.2)",
        termsDesc: "商业合作边界",
        privacy: "隐私政策 (v1.1)",
        privacyDesc: "本地加密与数据协议",
        disclaimer: "免责声明与责任限制 (v1.1)",
        disclaimerDesc: "AI 算法输出的范围",
        refund: "退款政策 (v1.1)",
        refundDesc: "交易冲正参数",
      },
    },
    es: {
      meta: {
        title: "Contacto — Eastern OS",
        description: "¿Preguntas sobre Eastern OS, PASS o tu cuenta?",
        version: "Version 1.1",
        pageTitle: "Contacta Eastern OS",
      },
      intro: {
        p1: "Leemos cada mensaje. Personas reales del equipo de Eastern OS responden lo antes posible.",
        p2: "Elige el tema abajo para enrutarte más rápido.",
      },
      footer:
        "Esta página está localizada por comodidad. El soporte es más sólido en inglés y chino—puedes escribir en tu idioma; usamos traducción cuando hace falta.",
      billing: {
        title: "1. Facturación, PASS y suscripciones",
        body: "Problemas de pago, saldo PASS, Comprar Pass o Suscripción:",
        emailLabel: "Correo:",
        responseLabel: "Respuesta:",
        response: "Suele ser en 24 horas en días laborables.",
        note: "Para un reembolso, incluye el Transaction ID del pago.",
      },
      subscription: {
        title: "2. Cancelar suscripción (autoservicio)",
        bodyBefore: "Para detener la renovación automática de la Suscripción, no hace falta escribirnos. Usa",
        manageLink: "Administrar suscripción",
        bodyAfter: "en tu cuenta.",
      },
      privacy: {
        title: "3. Privacidad y datos",
        body: "Preguntas de privacidad, datos locales del navegador o el email de facturación:",
        emailLabel: "Correo:",
        responseLabel: "Respuesta:",
        response: "Suele ser en 48 horas.",
      },
      legal: {
        title: "4. Legal",
        body: "Asuntos legales, copyright o verificación formal:",
        emailLabel: "Correo:",
        responseLabel: "Respuesta:",
        response: "Suele ser en 5 días laborables.",
      },
      beforeWrite: {
        title: "Antes de escribir",
        body: "Muchas respuestas ya están en:",
        terms: "Términos del servicio (v1.2)",
        termsDesc: "Límites del compromiso comercial",
        privacy: "Política de privacidad (v1.1)",
        privacyDesc: "Cifrado local y protocolos de datos",
        disclaimer: "Aviso legal y limitación de responsabilidad (v1.1)",
        disclaimerDesc: "Alcance de las reflexiones algorítmicas de IA",
        refund: "Política de reembolso (v1.1)",
        refundDesc: "Parámetros de reversión de transacciones",
      },
    },
    fr: {
      meta: {
        title: "Contact — Eastern OS",
        description: "Questions sur Eastern OS, le PASS ou ton compte ?",
        version: "Version 1.1",
        pageTitle: "Contacter Eastern OS",
      },
      intro: {
        p1: "Nous lisons chaque message. De vraies personnes de l’équipe Eastern OS répondent dès que possible.",
        p2: "Choisis le sujet ci-dessous pour un acheminement plus rapide.",
      },
      footer:
        "Cette page est localisée pour le confort. Le support est le plus solide en anglais et en chinois—tu peux écrire dans ta langue ; nous utilisons la traduction si besoin.",
      billing: {
        title: "1. Facturation, PASS et abonnements",
        body: "Problèmes de paiement, solde PASS, Acheter un Pass ou Abonnement :",
        emailLabel: "E-mail :",
        responseLabel: "Réponse :",
        response: "En général sous 24 heures les jours ouvrables.",
        note: "Pour un remboursement, inclus l’identifiant de transaction du paiement.",
      },
      subscription: {
        title: "2. Annuler l’abonnement (en libre-service)",
        bodyBefore: "Pour arrêter le renouvellement auto de l’Abonnement, pas besoin d’écrire. Utilise",
        manageLink: "Gérer l’abonnement",
        bodyAfter: "dans ton compte.",
      },
      privacy: {
        title: "3. Confidentialité et données",
        body: "Questions de confidentialité, données locales du navigateur ou e-mail de facturation :",
        emailLabel: "E-mail :",
        responseLabel: "Réponse :",
        response: "En général sous 48 heures.",
      },
      legal: {
        title: "4. Juridique",
        body: "Demandes juridiques, copyright ou vérification formelle :",
        emailLabel: "E-mail :",
        responseLabel: "Réponse :",
        response: "En général sous 5 jours ouvrables.",
      },
      beforeWrite: {
        title: "Avant d’écrire",
        body: "Beaucoup de réponses sont déjà ici :",
        terms: "Conditions d’utilisation (v1.2)",
        termsDesc: "Limites de l’engagement commercial",
        privacy: "Politique de confidentialité (v1.1)",
        privacyDesc: "Chiffrement local et protocoles de données",
        disclaimer: "Avertissement et limitation de responsabilité (v1.1)",
        disclaimerDesc: "Portée des réflexions algorithmiques d’IA",
        refund: "Politique de remboursement (v1.1)",
        refundDesc: "Paramètres d’annulation de transaction",
      },
    },
  };

  for (const loc of ["en", "zh", "es", "fr"]) {
    const p = `messages/${loc}/contact.json`;
    const existing = readJson(p);
    const next = { ...existing, ...contacts[loc] };
    // keep crisis block from existing (SoT: keep crisis)
    if (existing.crisis) next.crisis = existing.crisis;
    // merge nested carefully
    for (const k of Object.keys(contacts[loc])) {
      if (k === "crisis") continue;
      if (typeof contacts[loc][k] === "object" && existing[k]) {
        next[k] = { ...existing[k], ...contacts[loc][k] };
      } else {
        next[k] = contacts[loc][k];
      }
    }
    writeJson(p, next);
  }
  log("MF9 contact done");
}


// ─── 3+4+8+10 v2-landing.html ────────────────────────────────
{
  let html = read("public/v2-landing.html");

  // ES methodology bottom: llamadas → decisiones (idempotent if already fixed)
  html = html.replace(
    /Hecho para <strong>llamadas de alto riesgo<\/strong>/g,
    "Hecho para <strong>decisiones de alto riesgo</strong>"
  );
  // Also plain text variants without strong
  html = html.replace(
    /Hecho para \*\*llamadas de alto riesgo\*\*/g,
    "Hecho para **decisiones de alto riesgo**"
  );
  html = html.replace(/llamadas de alto riesgo/g, "decisiones de alto riesgo");

  // ES How Stage 3: más tenso → más ajustado
  html = html.replace(/más tenso/g, "más ajustado");
  html = html.replace(/mas tenso/g, "más ajustado");

  // FR Methodology Card1: forks/timing → bifurcations/tempo
  html = html.replace(
    /une lentille <span class="gold-gradient">structurelle<\/span> sur les <strong>forks<\/strong>, le <strong>timing<\/strong> et les conséquences/g,
    'une lentille <span class="gold-gradient">structurelle</span> sur les <strong>bifurcations</strong>, le <strong>tempo</strong> et les conséquences'
  );
  html = html.replace(
    /lentille <strong>structurelle<\/strong> sur les <strong>forks<\/strong>, le <strong>timing<\/strong> et les conséquences/g,
    "lentille <strong>structurelle</strong> sur les <strong>bifurcations</strong>, le <strong>tempo</strong> et les conséquences"
  );
  // JSON-escaped FR methodology body variants inside I18N blobs
  html = html.replace(/sur les \*\*forks\*\*, le \*\*timing\*\*/g, "sur les **bifurcations**, le **tempo**");
  html = html.replace(/sur les <strong>forks<\/strong>, le <strong>timing<\/strong>/g, "sur les <strong>bifurcations</strong>, le <strong>tempo</strong>");
  html = html.replace(/les \*\*forks\*\*, le \*\*timing\*\* et les conséquences/g, "les **bifurcations**, le **tempo** et les conséquences");

  // Broader FR forks/timing in methodology context (careful — scenarios may use forks as product term)
  // Only replace FR methodology-style phrases:
  html = html.replace(
    /(structurelle<\/span> sur les )forks(, )timing( et)/g,
    "$1bifurcations$2tempo$3"
  );

  // FR course complète → session complète
  html = html.replace(/une course complète/g, "une session complète");
  html = html.replace(/course complète/g, "session complète");

  // FR How Stage 4 / privacy: chat → conversation (product dialogue)
  // Targeted replacements inside FR privacy pack strings
  html = html.replace(/pas un <strong>chat<\/strong> qui disparaît/g, "pas une <strong>conversation</strong> qui disparaît");
  html = html.replace(/pas un \*\*chat\*\* qui disparaît/g, "pas une **conversation** qui disparaît");

  // FR privacy pack chat→conversation (common patterns)
  const frChatReplacements = [
    ["Ton chat et le rapport restent", "Ta conversation et le rapport restent"],
    ["historique de chat", "historique de conversation"],
    ["ces chats n’apparaissent pas", "ces conversations n’apparaissent pas"],
    ["ces chats n'apparaissent pas", "ces conversations n'apparaissent pas"],
    ["les anciens chats ne te suivent pas", "les anciennes conversations ne te suivent pas"],
    ["sert au PASS—pas à tes chats", "sert au PASS—pas à tes conversations"],
    ["sert au PASS—pas à tes chats", "sert au PASS—pas à tes conversations"],
    ["pas les anciens chats du premier", "pas les anciennes conversations du premier"],
    ["ces chats ?", "ces conversations ?"],
    ["PASS et chats, ce sont deux choses", "PASS et conversations, ce sont deux choses"],
    ["sauvegarde du chat", "sauvegarde de la conversation"],
    ["pas une sauvegarde du chat", "pas une sauvegarde de la conversation"],
  ];
  for (const [a, b] of frChatReplacements) {
    if (html.includes(a)) html = html.split(a).join(b);
  }
  // Also handle HTML entity / curly apostrophe variants already in file
  html = html.replace(/Ton chat et le rapport/g, "Ta conversation et le rapport");
  html = html.replace(/historique de chat/g, "historique de conversation");
  html = html.replace(/anciens chats/g, "anciennes conversations");
  html = html.replace(/tes chats/g, "tes conversations");
  html = html.replace(/ces chats/g, "ces conversations");
  html = html.replace(/PASS et chats/g, "PASS et conversations");
  html = html.replace(/du chat,/g, "de la conversation,");
  html = html.replace(/du chat</g, "de la conversation<");
  html = html.replace(/du chat"/g, 'de la conversation"');
  html = html.replace(/sauvegarde du chat/g, "sauvegarde de la conversation");

  // Pricing Card1 L4 — unused one-time Pass refund (4-lang)
  // Find features arrays in PRICING_I18N and replace one-click refund lines
  const pricingL4 = {
    en: "<strong>Unused one-time Passes can be refunded in PASS details.</strong> Timing follows your payment provider.",
    zh: "<strong>未使用的一次性 Pass 可在 PASS 详情申请退款。</strong> 到账时间按支付渠道规则。",
    es: "<strong>Los Pass de una sola compra sin usar se pueden reembolsar en detalles de PASS.</strong> Los plazos siguen a tu proveedor de pago.",
    fr: "<strong>Les Pass ponctuels non utilisés peuvent être remboursés dans les détails PASS.</strong> Les délais suivent ton prestataire de paiement.",
  };

  // Replace common old L4 patterns
  const oldL4Patterns = [
    /one-click refund anytime\.?/gi,
    /支持随时一键退款\.?/,
    /reembolso con un clic en cualquier momento\.?/gi,
    /remboursement en un clic à tout moment\.?/gi,
    /One-click refund anytime\.?/g,
    /<strong>One-click refund<\/strong> anytime\.?/gi,
    /\*\*One-click refund\*\* anytime\.?/gi,
    /随时一键退款/,
    /un clic en cualquier momento/,
    /en un clic à tout moment/,
  ];

  // More precise: replace feature strings that mention one-click refund
  html = html.replace(
    /[^"\n]*one-click refund[^"\n]*/gi,
    (m) => {
      if (/subscription|cancel|取消|annul/i.test(m) && !/Pass|PASS|Buy/i.test(m)) return m;
      // If this looks like Card1 L4 / Buy Pass refund line, replace with EN L4 (locale-specific handled below)
      return m;
    }
  );

  // Locale-specific Buy Pass refund feature lines
  const buyPassRefundOld = [
    // EN
    ["one-click refund anytime", pricingL4.en],
    ["One-click refund anytime", pricingL4.en],
    ["<strong>One-click refund</strong> anytime", pricingL4.en],
    ["Supports one-click refund anytime", pricingL4.en],
    // ZH
    ["支持随时一键退款", pricingL4.zh],
    ["随时一键退款", pricingL4.zh],
    // ES
    ["reembolso con un clic en cualquier momento", pricingL4.es],
    ["Reembolso con un clic en cualquier momento", pricingL4.es],
    // FR
    ["remboursement en un clic à tout moment", pricingL4.fr],
    ["Remboursement en un clic à tout moment", pricingL4.fr],
  ];
  for (const [old, neu] of buyPassRefundOld) {
    if (html.includes(old)) {
      // Only replace when in pricing-ish context — do whole-string feature replacement carefully
      html = html.split(old).join(neu);
    }
  }

  // If L4 already partially updated, ensure exact SoT strings present for card1 features
  // Try to find card1 features 4th item patterns like "Valid until used" neighbors

  // TEAM_COPY ZH roles
  const zhRoles = {
    "Max C.": "创始人兼首席执行官",
    "Arthur M.": "首席系统架构师",
    "Marcus T.": "首席算法与数据工程师",
    "Elena S.": "决策策略负责人",
    "Maya C.": "产品与体验负责人",
  };

  // Replace roles inside TEAM_COPY.zh block
  const teamZhIdx = html.indexOf("TEAM_COPY");
  if (teamZhIdx >= 0) {
    // Find zh: { ... team: [
    const zhTeamMatch = html.match(/TEAM_COPY\s*=\s*\{[\s\S]*?\bzh\s*:\s*\{[\s\S]*?team\s*:\s*\[([\s\S]*?)\]/);
    if (zhTeamMatch) {
      let teamBlock = zhTeamMatch[1];
      for (const [name, role] of Object.entries(zhRoles)) {
        // match objects with this name and replace role field
        const nameEsc = name.replace(".", "\\.");
        const re = new RegExp(`(name\\s*:\\s*"${nameEsc}"[\\s\\S]*?role\\s*:\\s*")([^"]*)(")`);
        if (re.test(teamBlock)) {
          teamBlock = teamBlock.replace(re, `$1${role}$3`);
        } else {
          // alternate JSON style "name": "Max C."
          const re2 = new RegExp(`("name"\\s*:\\s*"${nameEsc}"[\\s\\S]*?"role"\\s*:\\s*")([^"]*)(")`);
          teamBlock = teamBlock.replace(re2, `$1${role}$3`);
        }
      }
      html = html.replace(zhTeamMatch[1], teamBlock);
    }
  }

  // Hero mock: hide Personal Energy Profile / Daily Cosmic Resonance overlays via CSS
  const heroHideCss = `
        /* Must-fix 10: hide energy/cosmic overlay chrome on hero product-preview mocks */
        .v2-hero-preview [data-energy-overlay],
        .v2-hero-preview .energy-overlay,
        .v2-hero-mock-energy,
        .v2-preview-label-energy,
        #v2-hero-preview .personal-energy-profile,
        #v2-hero-preview .daily-cosmic-resonance,
        [data-preview-label="Personal Energy Profile"],
        [data-preview-label="Daily Cosmic Resonance"] {
          display: none !important;
        }
        /* Crop baked-in energy/cosmic title bands on carousel mock frames (top chrome) */
        #v2-hero .v2-hero-visual img,
        #v2-hero .v2-preview-frame img,
        #v2-hero .v2-mock-frame img,
        .v2-hero-carousel img,
        .v2-product-preview img,
        [data-hero-mock] img {
          object-fit: cover;
          object-position: center 28%;
          /* pull crop upward enough to hide typical top title bars on v2/v3/v4 mocks */
        }
        /* If mock frames use background-image slides */
        .v2-hero-slide[data-mock="energy"],
        .v2-hero-slide[data-mock="cosmic"] {
          display: none !important;
        }
`;

  if (!html.includes("Must-fix 10: hide energy/cosmic")) {
    // Insert before </style> of first major style block, or before </head>
    if (html.includes("</style>")) {
      html = html.replace("</style>", heroHideCss + "\n        </style>");
    } else if (html.includes("</head>")) {
      html = html.replace("</head>", `<style>${heroHideCss}</style></head>`);
    }
  }

  // Also scrub any leftover visible i18n strings on landing for energy product names in captions
  html = html.replace(/Personal Energy Profile/g, "Decision dialogue preview");
  html = html.replace(/Daily Cosmic Resonance/g, "Decision report preview");
  html = html.replace(/Personal energy chart/gi, "Decision dialogue preview");

  // ZH energy leftovers if any
  html = html.replace(/个人能量档案/g, "决策对话预览");
  html = html.replace(/每日宇宙共鸣/g, "决策报告预览");

  // FR methodology forks leftover in I18N JSON strings — catch "forks" near "structurelle"
  html = html.replace(
    /(structurelle[^"]{0,40})forks([^"]{0,20})timing/g,
    "$1bifurcations$2tempo"
  );

  write("public/v2-landing.html", html);
  log("MF3+4+8+10 landing done");
}

// ─── verify summaries ────────────────────────────────────────
{
  const faq = read("public/v2/faq-i18n.js");
  const checks = [
    ["FAQ no bilingual paren", !/Answer（|Analysis（|Strategy（|Stratagem（|Guard（|Close（|reasoning（/.test(faq)],
    ["FAQ ZH P6 今晚与收尾", faq.includes("今晚与收尾")],
    ["FAQ ZH no 出门仪式", !faq.includes("出门仪式")],
    ["FAQ ZH q9 购买", faq.includes("购买/账单收据邮件")],
    ["FAQ EN refund PASS details", faq.includes("unused purchased Passes can be refunded in PASS details")],
    ["FAQ no one-click refund anytime", !faq.includes("one-click refund anytime")],
  ];
  const en = readJson("messages/en.json");
  checks.push(["passRow.balanceAria", en.workspace?.passRow?.balanceAria === "PASS balance: {n}"]);
  checks.push(["passRow.buyAria", en.workspace?.passRow?.buyAria === "Buy PASS"]);
  checks.push(["passRow chip PASS·", en.workspace?.passRow?.balance === "PASS·{n}"]);
  checks.push(["planPersonal Subscription", en.account?.planPersonal === "Subscription"]);
  checks.push(["planFlex Buy Pass", en.account?.planFlex === "Buy Pass"]);
  checks.push(["planTeam hidden empty", en.account?.planTeam === ""]);
  checks.push(["birthForm no Pivot", !String(en.birthForm?.subtitle || "").includes("Pivot")]);
  checks.push(["birth no true solar expl1", !String(en.profile?.birth_location?.explanation_1 || "").toLowerCase().includes("true solar")]);
  const contact = readJson("messages/en/contact.json");
  checks.push(["contact no Token", !JSON.stringify(contact).includes("Token")]);
  checks.push(["contact no Monthly Pass", !JSON.stringify(contact).includes("Monthly Pass")]);
  checks.push(["contact PASS billing", contact.billing?.title?.includes("PASS")]);
  const landing = read("public/v2-landing.html");
  checks.push(["ES decisiones de alto riesgo", landing.includes("decisiones de alto riesgo")]);
  checks.push(["ES más ajustado", landing.includes("más ajustado")]);
  checks.push(["FR session complète", landing.includes("session complète")]);
  checks.push(["FR no course complète", !landing.includes("course complète")]);
  checks.push(["FR bifurcations", landing.includes("bifurcations")]);
  checks.push(["hero hide CSS", landing.includes("Must-fix 10: hide energy/cosmic")]);
  checks.push(["ZH role 创始人", landing.includes("创始人兼首席执行官")]);

  let failed = 0;
  for (const [name, ok] of checks) {
    log((ok ? "OK  " : "FAIL") + " " + name);
    if (!ok) failed++;
  }
  if (failed) {
    console.error("VERIFY FAILED: " + failed);
    process.exitCode = 1;
  } else {
    log("ALL CHECKS PASSED");
  }
}

fs.writeFileSync(path.join(root, "temp/mustfix-apply-report.txt"), report.join("\n"), "utf8");
