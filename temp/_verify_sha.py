# -*- coding: utf-8 -*-
import subprocess, re, sys
sys.stdout.reconfigure(encoding="utf-8")
sha = subprocess.check_output(["git","rev-parse","HEAD"], text=True).strip()
blob = subprocess.check_output(["git","show", f"{sha}:public/v2-landing.html"])
text = blob.decode("utf-8")
print("SHA", sha)
hard = ["/month","per month","每月","任意产品","全站任意","Family / Team","$4.99","$9.99","$29.99","Five Specialized","any product","PRICING_I18N ="]
for p in hard:
    print(f"GREP {p!r}: {text.count(p)}")
print(f"$19.99: {text.count('$19.99')}")
print(f"$59.99: {text.count('$59.99')}")
print(f"1 PASS: {text.count('1 PASS')}")
print(f"5 PASS: {text.count('5 PASS')}")
