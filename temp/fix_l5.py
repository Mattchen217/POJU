# -*- coding: utf-8 -*-
import json
from pathlib import Path

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

# --- messages JSON ---
for loc in ["en", "zh", "es", "fr"]:
    path = Path(f"messages/{loc}.json")
    with path.open("r", encoding="utf-8") as f:
        raw = f.read()
    d = json.loads(raw)
    cur_l5 = d["passPurchase"]["personalFeatures"][3]
    cur_hint = d["account"]["subCardHint"]
    assert cur_l5 == OLD_L5[loc], (loc, "L5", cur_l5, OLD_L5[loc])
    assert cur_hint == OLD_HINT[loc], (loc, "hint", cur_hint, OLD_HINT[loc])
    # Replace via exact string in raw to preserve formatting
    assert OLD_L5[loc] in raw
    assert OLD_HINT[loc] in raw
    # Use JSON-escaped forms for replacement in file
    # Safer: load, mutate, dump with same style is hard; do targeted replace of the exact JSON string values
    # Replace as they appear in JSON (identical for these ASCII/CJK strings)
    new_raw = raw.replace(
        json.dumps(OLD_L5[loc], ensure_ascii=False)[1:-1],  # unquoted content may differ for escapes
        "___DO_NOT_USE___",
    )
    # Better approach: locate keys and replace whole quoted values with json.dumps

def replace_json_string_value(raw: str, old: str, new: str) -> str:
    old_lit = json.dumps(old, ensure_ascii=False)
    new_lit = json.dumps(new, ensure_ascii=False)
    if old_lit not in raw:
        raise SystemExit(f"OLD literal not found: {old_lit!r}")
    count = raw.count(old_lit)
    if count != 1:
        raise SystemExit(f"Expected 1 occurrence of {old_lit!r}, found {count}")
    return raw.replace(old_lit, new_lit, 1)

for loc in ["en", "zh", "es", "fr"]:
    path = Path(f"messages/{loc}.json")
    raw = path.read_text(encoding="utf-8")
    raw = replace_json_string_value(raw, OLD_L5[loc], L5[loc])
    raw = replace_json_string_value(raw, OLD_HINT[loc], HINT[loc])
    # verify
    d = json.loads(raw)
    assert d["passPurchase"]["personalFeatures"][3] == L5[loc]
    assert d["account"]["subCardHint"] == HINT[loc]
    path.write_text(raw, encoding="utf-8", newline="\n")
    print(f"updated messages/{loc}.json")

# --- v2-landing.html ---
html_path = Path("public/v2-landing.html")
html = html_path.read_text(encoding="utf-8")

V2_OLD = {
    "en": '"Subscription credits use first."',
    "zh": '"订阅额度优先消耗"',
    "es": '"<strong>Orden de consumo:</strong> primero créditos de <strong>arrastre (carryover)</strong>, luego de <strong>suscripción</strong>, luego PASS <strong>comprados</strong>."',
    "fr": '"<strong>Ordre de consommation :</strong> d’abord le <strong>report (carryover)</strong>, puis l’<strong>abonnement</strong>, puis les PASS <strong>achetés</strong>."',
}
V2_NEW = {loc: json.dumps(L5[loc], ensure_ascii=False) for loc in L5}

for loc in ["en", "zh", "es", "fr"]:
    old = V2_OLD[loc]
    new = V2_NEW[loc]
    if old not in html:
        raise SystemExit(f"v2 missing {loc}: {old!r}")
    if html.count(old) != 1:
        raise SystemExit(f"v2 count {loc}: {html.count(old)}")
    html = html.replace(old, new, 1)
    print(f"updated v2 {loc}")

html_path.write_text(html, encoding="utf-8", newline="\n")

# final verify
html2 = html_path.read_text(encoding="utf-8")
for loc, s in L5.items():
    assert json.dumps(s, ensure_ascii=False) in html2, loc
assert "订阅额度优先消耗" not in html2
assert "Subscription credits use first." not in html2
assert "买断" not in L5["zh"]
print("ALL OK")
for loc in L5:
    print(loc, "L5=", L5[loc])
