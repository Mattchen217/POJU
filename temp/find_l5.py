import os, sys
sys.stdout.reconfigure(encoding="utf-8")
needles = [
    "Subscription credits use first.",
    "Subscription credits use before purchased",
    "订阅额度优先消耗",
    "订阅额度优先于已购",
    "Los créditos de suscripción se usan primero",
    "Los créditos de suscripción se usan antes",
    "Les crédits d'abonnement sont utilisés en premier",
    "Les crédits d'abonnement avant",
    "Les crédits d\u2019abonnement sont utilisés en premier",
    "Les crédits d\u2019abonnement avant",
]
roots = ["messages", "public", "lib", "components", "app"]
for root in roots:
    if not os.path.isdir(root):
        continue
    for dirpath, _, files in os.walk(root):
        for fn in files:
            if not fn.endswith((".json", ".html", ".ts", ".tsx", ".js", ".jsx", ".md")):
                continue
            path = os.path.join(dirpath, fn)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    text = f.read()
            except Exception:
                continue
            for n in needles:
                if n in text:
                    print(f"FOUND in {path}: {n[:70]!r}")
