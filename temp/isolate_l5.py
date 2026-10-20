# -*- coding: utf-8 -*-
"""Isolate L5-only changes: start from HEAD blobs, apply only L5/subCardHint, keep other WIP aside."""
import json
import shutil
import subprocess
from pathlib import Path

FILES = [
    "messages/en.json",
    "messages/zh.json",
    "messages/es.json",
    "messages/fr.json",
    "public/v2-landing.html",
]

backup = Path("temp/l5-wip-backup")
backup.mkdir(parents=True, exist_ok=True)

# 1) Backup current WIP (includes L5 + unrelated)
for f in FILES:
    dest = backup / f.replace("/", "__")
    shutil.copy2(f, dest)
    print("backed up", f, "->", dest)

L5 = {
    "en": "Spend order: any carryover first, then subscription credits, then purchased PASS.",
    "zh": "消耗顺序：先用结转额度，再订阅额度，最后已购买 PASS。",
    "es": "Orden de consumo: primero créditos de arrastre (carryover), luego de suscripción, luego PASS comprados.",
    "fr": "Ordre de consommation : d’abord le report (carryover), puis l’abonnement, puis les PASS achetés.",
}
HINT = {
    "en": "Subscription: **5 PASS / month**. Spend order: any carryover first, then subscription credits, then purchased PASS.",
    "zh": "订阅：**每月 5 PASS**。消耗顺序：先用结转额度，再订阅额度，最后已购买 PASS。",
    "es": "Suscripción: **5 PASS / mes**. Orden de consumo: primero créditos de arrastre (carryover), luego de suscripción, luego PASS comprados.",
    "fr": "Abonnement : **5 PASS / mois**. Ordre de consommation : d’abord le report (carryover), puis l’abonnement, puis les PASS achetés.",
}
OLD_L5 = {
    "en": "Subscription credits use first.",
    "zh": "订阅额度优先消耗",
    "es": "Los créditos de suscripción se usan primero.",
    "fr": "Les crédits d’abonnement sont utilisés en premier.",
}
OLD_HINT = {
    "en": "Subscription: **5 PASS / month**. Subscription credits use before purchased Passes.",
    "zh": "订阅：**每月 5 PASS**。订阅额度优先于已购 Pass 消耗。",
    "es": "Suscripción: **5 PASS / mes**. Los créditos de suscripción se usan antes que los comprados.",
    "fr": "Abonnement : **5 PASS / mois**. Les crédits d’abonnement avant les Passes achetés.",
}
V2_OLD_ES = '"<strong>Orden de consumo:</strong> primero créditos de <strong>arrastre (carryover)</strong>, luego de <strong>suscripción</strong>, luego PASS <strong>comprados</strong>."'
V2_OLD_FR = '"<strong>Ordre de consommation :</strong> d’abord le <strong>report (carryover)</strong>, puis l’<strong>abonnement</strong>, puis les PASS <strong>achetés</strong>."'

def replace_json_string_value(raw: str, old: str, new: str) -> str:
    old_lit = json.dumps(old, ensure_ascii=False)
    new_lit = json.dumps(new, ensure_ascii=False)
    if old_lit not in raw:
        raise SystemExit(f"OLD literal not found: {old_lit!r}")
    count = raw.count(old_lit)
    if count != 1:
        raise SystemExit(f"Expected 1 occurrence of {old_lit!r}, found {count}")
    return raw.replace(old_lit, new_lit, 1)

# 2) Restore HEAD versions
subprocess.check_call(["git", "checkout", "HEAD", "--"] + FILES)
print("restored HEAD for", FILES)

# 3) Apply only L5 + subCardHint on HEAD
for loc in ["en", "zh", "es", "fr"]:
    path = Path(f"messages/{loc}.json")
    raw = path.read_text(encoding="utf-8")
    raw = replace_json_string_value(raw, OLD_L5[loc], L5[loc])
    raw = replace_json_string_value(raw, OLD_HINT[loc], HINT[loc])
    d = json.loads(raw)
    assert d["passPurchase"]["personalFeatures"][3] == L5[loc]
    assert d["account"]["subCardHint"] == HINT[loc]
    path.write_text(raw, encoding="utf-8", newline="\n")
    print("L5-only messages", loc)

html_path = Path("public/v2-landing.html")
html = html_path.read_text(encoding="utf-8")
repls = [
    ('"Subscription credits use first."', json.dumps(L5["en"], ensure_ascii=False)),
    ('"订阅额度优先消耗"', json.dumps(L5["zh"], ensure_ascii=False)),
    (V2_OLD_ES, json.dumps(L5["es"], ensure_ascii=False)),
    (V2_OLD_FR, json.dumps(L5["fr"], ensure_ascii=False)),
]
for old, new in repls:
    if old not in html:
        raise SystemExit(f"v2 HEAD missing: {old[:80]!r}")
    if html.count(old) != 1:
        raise SystemExit(f"v2 count bad for {old[:40]!r}: {html.count(old)}")
    html = html.replace(old, new, 1)
html_path.write_text(html, encoding="utf-8", newline="\n")
print("L5-only v2-landing")

# show stats
out = subprocess.check_output(["git", "diff", "--stat"] + FILES, encoding="utf-8")
print(out)
