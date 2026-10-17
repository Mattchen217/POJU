from pathlib import Path
import re
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
# find all eos-scenarios-h1 locales
for m in re.finditer(r'eos-scenarios-h1[^\n]{0,200}', t):
    print("L:", repr(m.group(0)[:180]))
# translations dict
for key in ["eos-scenarios-h1", "eosScenariosH1", "scenarios-h1", "Built for the decisions"]:
    idxs = [i for i in range(len(t)) if t.startswith(key, i) or t.startswith('"'+key, i)]
    print(key, "count", t.count(key))
# dump i18n block around scenarios
i = t.find("eos-scenarios-h1")
# find in dicts
for m in re.finditer(r'["\']eos-scenarios-h1["\']\s*:\s*["\']([^"\']+)["\']', t):
    print("DICT:", m.group(0))
# zh strings
for m in re.finditer(r'.{0,40}要紧.{0,40}', t):
    print("ZH:", m.group(0))
for m in re.finditer(r'.{0,40}Built for the decisions.{0,40}', t):
    print("EN:", m.group(0))
