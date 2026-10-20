const fs = require("fs");

const frPath = "messages/fr.json";
const fr = JSON.parse(fs.readFileSync(frPath, "utf8"));

fr.home.promises.card1.content =
  "Ta conversation et le rapport restent sur le téléphone ou l’ordinateur que tu utilises maintenant—dans ce navigateur seulement. Ils ne sont pas envoyés comme historique de conversation dans notre cloud. Tu veux les effacer ? Vide les données de ce navigateur (ou ferme une fenêtre privée). Sur un autre téléphone, ordinateur ou navigateur, ces conversations n’apparaissent pas—même avec le même compte. Un nouvel appareil, c’est une nouvelle copie locale—les anciennes conversations ne te suivent pas toutes seules ; tu ne les vois que sur l’appareil d’origine.";

fr.home.promises.card2.title = "Ton compte sert au PASS—pas à tes conversations";
fr.home.promises.card2.content =
  "Te connecter sert surtout à acheter des PASS et voir ton solde et tes reçus. Cela ne veut pas dire que tes conversations sont sauvegardées dans le cloud du compte. Sur un autre appareil, tu verras ton PASS—mais pas les anciennes conversations du premier. Tu veux revoir ces conversations ? Retourne sur le même appareil et le même navigateur—ton compte ne les synchronise pas. PASS et conversations, ce sont deux choses ; n’attends pas un seul enregistrement cloud.";

fr.home.promises.card3.content =
  "Tu as besoin de la conversation ou du rapport après avoir quitté ce navigateur ? Avant de vider les données ou de changer d’appareil, envoie-toi le rapport par e-mail, ou exporte une copie. Ainsi tu gardes quelque chose à rouvrir plus tard et à vérifier face au chemin clarifié. L’e-mail d’achat est un reçu—pas une sauvegarde de la conversation, et il ne restaure pas le dialogue. Si tu effaces la copie locale, on ne peut pas la ramener—alors emporte-en une ici d’abord ; n’attends pas d’avoir vidé les données ou changé d’appareil.";

fr.birth_picker.side_privacy_intro =
  "Le dialogue et les livrables restent dans ce navigateur sur ton appareil. Ton compte sert au solde PASS et à la facturation—pas une étagère cloud de l’historique de conversation.";
fr.birth_picker.side_isolation_title = "Les appareils ne synchronisent pas les conversations";
fr.birth_picker.side_isolation_body =
  "Un autre navigateur ou appareil ne montrera pas les conversations précédentes—même avec le même compte. Le solde PASS suit toujours le compte.";

fr.poju.chat.context_summary_edit_chat = "Ajouter des détails dans la conversation";
fr.poju.chat.unlock_report_modal_hint =
  "Vous pouvez rouvrir ce portrait complet depuis la conversation à tout moment.";
fr.poju.summary_editor.back_to_conversation = "Retour à la conversation";

const sessionLine =
  "1 Pass = une session complète : dialogue → voie principale + secours + rapport → rappels 30 jours fournis ensemble.";
fr.passPurchase.flexFeatures[0] = sessionLine;
fr.passPurchase.personalFeatures[0] = sessionLine;

if (fr.workspace && fr.workspace.progress && fr.workspace.progress.chat === "Chat") {
  fr.workspace.progress.chat = "Conversation";
}

fs.writeFileSync(frPath, JSON.stringify(fr, null, 2) + "\n", "utf8");
console.log("patched messages/fr.json");

const zhPath = "messages/zh.json";
const zh = JSON.parse(fs.readFileSync(zhPath, "utf8"));
const replaceSolar = (s) => s.replace(/真太阳时/g, "出生地校准");
zh.marketingSite.poju.what_is.body = replaceSolar(zh.marketingSite.poju.what_is.body);
zh.poju.branding.feature_definition = replaceSolar(zh.poju.branding.feature_definition);
zh.syncro.location.asking_message = "Syncro 需要你的位置来校准方位与本地语境。";
fs.writeFileSync(zhPath, JSON.stringify(zh, null, 2) + "\n", "utf8");
console.log("patched messages/zh.json");

function walkHits(o, p, re, out) {
  if (typeof o === "string") {
    if (re.test(o)) out.push(p + ": " + o.slice(0, 120));
  } else if (o && typeof o === "object") {
    for (const k of Object.keys(o)) walkHits(o[k], p ? p + "." + k : k, re, out);
  }
}
const fr2 = JSON.parse(fs.readFileSync(frPath, "utf8"));
const course = [];
walkHits(fr2, "", /\bcourse\b/, course);
const chat = [];
walkHits(fr2, "", /\bchats?\b/i, chat);
console.log("FR course leftovers:", course);
console.log("FR chat leftovers:", chat);
const zh2 = JSON.parse(fs.readFileSync(zhPath, "utf8"));
const solar = [];
walkHits(zh2, "", /真太阳时/, solar);
console.log("ZH solar leftovers:", solar);
