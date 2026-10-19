# -*- coding: utf-8 -*-
"""Patch workbench intro/privacy i18n. HOLD form tip-as-title Ready."""
import json
from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")

SESSION_OPEN = {
    "en": {
        "kicker": "Eastern OS",
        "h1": "Sometimes reading isn’t enough.",
        "body": "You’ve read the books, talked to friends, and filled out every pros-and-cons list. The dilemma still won’t let go.",
        "leadIn": "Start a multi-turn decision dialogue for *this* stuck call. You’ll leave with a main path, a backup, a report you can reopen—and 30-day same-line reminders *provided together*. We advise. You decide.",
        "formSectionTitle": "Your details for this session",
        "formPrompt": "Enter or select your basic information",
        "formHelp": "**Birth date, time, and place — required** to structure this decision session. Used for Eastern decision-model context on *your* case—not fortune-telling.",
        "cta": "Continue",
    },
    "zh": {
        "kicker": "Eastern OS",
        "h1": "有时候，光靠读还不够。",
        "body": "书也读了，朋友也问了，利弊表也列了。卡住的那个决定还是不放手。",
        "leadIn": "为**这一次**卡住的决定，开启多轮决策对话。你会带走主路径、备用、还能再打开的报告，以及**同步提供**的 30 天同线提醒。我们给建议。决定权在你。",
        "formSectionTitle": "本次会话基本信息",
        "formPrompt": "请输入或选择你的基础信息",
        "formHelp": "**出生日期、时间与地点——必填**，用于结构化本次决策会话。按东方决策模型理解你的情境——**不是算命**。",
        "cta": "继续",
    },
    "es": {
        "kicker": "Eastern OS",
        "h1": "A veces leer no alcanza.",
        "body": "Ya leíste los libros, hablaste con amigos y llenaste cada lista de pros y contras. El dilema sigue sin soltarte.",
        "leadIn": "Empieza un diálogo multiturno de decisión para *esta* decisión atascada. Te llevas una ruta principal, un respaldo, un informe que puedes reabrir—y recordatorios de 30 días en la misma línea **proporcionados juntos**. Nosotros aconsejamos. Tú decides.",
        "formSectionTitle": "Tus datos para esta sesión",
        "formPrompt": "Ingresa o selecciona tu información básica",
        "formHelp": "**Fecha, hora y lugar de nacimiento — obligatorios** para estructurar esta sesión de decisión. Sirven de contexto con modelos de decisión orientales para *tu* caso—**no es adivinación**.",
        "cta": "Continuar",
    },
    "fr": {
        "kicker": "Eastern OS",
        "h1": "Parfois, lire ne suffit pas.",
        "body": "Tu as lu les livres, parlé aux amis, et rempli chaque liste pour/contre. Le dilemme ne te lâche toujours pas.",
        "leadIn": "Lance un dialogue multi-tours de décision pour *ce* choix bloqué. Tu repartiras avec une voie principale, un secours, un rapport que tu peux rouvrir—et des rappels 30 jours sur la même ligne **fournis ensemble**. Nous conseillons. Tu décides.",
        "formSectionTitle": "Vos informations pour cette session",
        "formPrompt": "Saisissez ou sélectionnez vos informations de base",
        "formHelp": "**Date, heure et lieu de naissance — obligatoires** pour structurer cette session de décision. Servent de contexte avec des modèles de décision orientaux pour *ton* cas—**pas de divination**.",
        "cta": "Continuer",
    },
}

# birth_picker keys used by form UI + privacy side rail
BIRTH_PICKER = {
    "en": {
        "form_section_title": "Your details for this session",
        "form_prompt": "Enter or select your basic information",
        "form_help": "Birth date, time, and place — required to structure this decision session. Used for Eastern decision-model context on your case—not fortune-telling.",
        "birth_date": "Date of birth",
        "birth_hour": "Time of birth",
        "continue": "Continue",
        "submit": "Continue",
        "side_privacy_title": "Privacy & security",
        "side_privacy_intro": "Dialogue and deliverables stay in this browser on your device. Your account is for PASS balance and billing—not a cloud shelf of chat history.",
        "side_local_title": "Stored in this browser",
        "side_local_body": "Session history lives in local storage here. You can clear it in the app anytime.",
        "side_wipe_title": "Cache / private windows",
        "side_wipe_body": "Clear cache or close an incognito window, and that local copy is gone.",
        "side_isolation_title": "Devices don’t sync chats",
        "side_isolation_body": "A different browser or device won’t show prior chats—even on the same login. PASS balance still follows the account.",
        "side_privacy_foot": "Checkout and PASS run through your account and payment provider. Birth details you enter are used to run this session—not sold as a destiny profile. Receipts are billing, not a chat backup. Export or email the dialogue if you want a copy.",
    },
    "zh": {
        "form_section_title": "本次会话基本信息",
        "form_prompt": "请输入或选择你的基础信息",
        "form_help": "出生日期、时间与地点——必填，用于结构化本次决策会话。按东方决策模型理解你的情境——不是算命。",
        "birth_date": "出生日期",
        "birth_hour": "出生时间",
        "continue": "继续",
        "submit": "继续",
        "side_privacy_title": "隐私与安全",
        "side_privacy_intro": "对话与交付物留在你设备上的当前浏览器。账号只管 PASS 余额与账单——不是聊天历史的云端货架。",
        "side_local_title": "存在当前浏览器",
        "side_local_body": "本场使用记录在本地存储。可随时在应用内清除。",
        "side_wipe_title": "缓存 / 无痕窗口",
        "side_wipe_body": "清缓存或关闭无痕窗口，这份本地副本就没了。",
        "side_isolation_title": "设备之间不同步聊天",
        "side_isolation_body": "换浏览器或换设备看不到以前的聊天——即使同一登录。PASS 余额仍跟账户走。",
        "side_privacy_foot": "结账与 PASS 走账户和支付网关。你填写的出生信息只用于跑这一场——不会当成命运档案出售。收据是账单，不是聊天备份。需要副本请导出或邮件带走对话。",
    },
    "es": {
        "form_section_title": "Tus datos para esta sesión",
        "form_prompt": "Ingresa o selecciona tu información básica",
        "form_help": "Fecha, hora y lugar de nacimiento — obligatorios para estructurar esta sesión de decisión. Sirven de contexto con modelos de decisión orientales para tu caso—no es adivinación.",
        "birth_date": "Fecha de nacimiento",
        "birth_hour": "Hora de nacimiento",
        "continue": "Continuar",
        "submit": "Continuar",
        "side_privacy_title": "Privacidad y seguridad",
        "side_privacy_intro": "El diálogo y los entregables quedan en este navegador en tu dispositivo. Tu cuenta es para el saldo PASS y la facturación—no un estante en la nube del historial de chat.",
        "side_local_title": "Guardado en este navegador",
        "side_local_body": "El historial de la sesión vive en el almacenamiento local aquí. Puedes borrarlo en la app cuando quieras.",
        "side_wipe_title": "Caché / ventanas privadas",
        "side_wipe_body": "Si borras la caché o cierras una ventana de incógnito, esa copia local desaparece.",
        "side_isolation_title": "Los dispositivos no sincronizan chats",
        "side_isolation_body": "Otro navegador o dispositivo no mostrará chats previos—aunque sea el mismo inicio de sesión. El saldo PASS sigue a la cuenta.",
        "side_privacy_foot": "El checkout y el PASS pasan por tu cuenta y el proveedor de pago. Los datos de nacimiento que ingresas sirven para correr esta sesión—no se venden como perfil de destino. Los recibos son facturación, no un respaldo del chat. Exporta o envía el diálogo por correo si quieres una copia.",
    },
    "fr": {
        "form_section_title": "Vos informations pour cette session",
        "form_prompt": "Saisissez ou sélectionnez vos informations de base",
        "form_help": "Date, heure et lieu de naissance — obligatoires pour structurer cette session de décision. Servent de contexte avec des modèles de décision orientaux pour ton cas—pas de divination.",
        "birth_date": "Date de naissance",
        "birth_hour": "Heure de naissance",
        "continue": "Continuer",
        "submit": "Continuer",
        "side_privacy_title": "Confidentialité et sécurité",
        "side_privacy_intro": "Le dialogue et les livrables restent dans ce navigateur sur ton appareil. Ton compte sert au solde PASS et à la facturation—pas une étagère cloud de l’historique de chat.",
        "side_local_title": "Stocké dans ce navigateur",
        "side_local_body": "L’historique de session vit dans le stockage local ici. Tu peux l’effacer dans l’app à tout moment.",
        "side_wipe_title": "Cache / fenêtres privées",
        "side_wipe_body": "Vide le cache ou ferme une fenêtre privée, et cette copie locale disparaît.",
        "side_isolation_title": "Les appareils ne synchronisent pas les chats",
        "side_isolation_body": "Un autre navigateur ou appareil ne montrera pas les chats précédents—même avec le même compte. Le solde PASS suit toujours le compte.",
        "side_privacy_foot": "Le checkout et le PASS passent par ton compte et le prestataire de paiement. Les détails de naissance que tu saisis servent à faire tourner cette session—pas vendus comme profil de destin. Les reçus sont de la facturation, pas une sauvegarde de chat. Exporte ou envoie le dialogue par e-mail si tu veux une copie.",
    },
}

# birth_location / place label lives under birth_picker or nearby — check birth_location key in birth_confirm
PLACE = {
    "en": "Place of birth",
    "zh": "出生地点",
    "es": "Lugar de nacimiento",
    "fr": "Lieu de naissance",
}


def load(loc):
    p = ROOT / "messages" / f"{loc}.json"
    with p.open(encoding="utf-8") as f:
        return json.load(f), p


def save(p, data):
    with p.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    report = []
    for loc in ("en", "zh", "es", "fr"):
        data, path = load(loc)
        ws = data.setdefault("workspace", {})
        before_so = ws.get("sessionOpen")
        ws["sessionOpen"] = SESSION_OPEN[loc]
        report.append(f"{loc} workspace.sessionOpen: {'replaced' if before_so else 'added'}")

        bp = data.setdefault("birth_picker", {})
        for k, v in BIRTH_PICKER[loc].items():
            old = bp.get(k)
            bp[k] = v
            report.append(f"  birth_picker.{k}: {old!r} -> {v!r}" if old != v else f"  birth_picker.{k}: (unchanged)")

        # place of birth: birth_confirm.location_label and birth_picker if present
        if "birth_location" in bp or True:
            # add birth_place label key for SoT field; keep birth_location if used elsewhere
            old = bp.get("birth_place")
            bp["birth_place"] = PLACE[loc]
            report.append(f"  birth_picker.birth_place: {old!r} -> {PLACE[loc]!r}")

        bc = data.get("birth_confirm")
        if isinstance(bc, dict) and "location_label" in bc:
            old = bc.get("location_label")
            # only update FR fully for place; EN/ZH/ES align to SoT place wording when close
            if loc == "fr":
                bc["location_label"] = PLACE[loc]
                report.append(f"  birth_confirm.location_label: {old!r} -> {PLACE[loc]!r}")

        save(path, data)
        report.append(f"wrote {path}")

    out = ROOT / "temp" / "workbench-i18n-patch-report.txt"
    out.parent.mkdir(exist_ok=True)
    out.write_text("\n".join(report), encoding="utf-8")
    print("\n".join(report[-20:]))
    print(f"full report: {out}")


if __name__ == "__main__":
    main()
